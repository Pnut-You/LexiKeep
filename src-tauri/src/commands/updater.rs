use serde::Deserialize;

const GITHUB_API: &str = "https://api.github.com/repos/Pnut-You/LexiKeep/releases/latest";
const RELEASE_URL: &str = "https://github.com/Pnut-You/LexiKeep/releases/latest";

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    published_at: Option<String>,
    #[serde(default)]
    assets: Vec<GithubAsset>,
}

#[derive(Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatestRelease {
    pub version: String,
    pub url: String,
    pub published_at: Option<String>,
}

#[cfg(all(target_os = "linux", target_arch = "x86_64"))]
const PREFERRED_ASSET_SUFFIXES: &[&str] = &["_amd64.deb"];

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
const PREFERRED_ASSET_SUFFIXES: &[&str] = &["_x64-setup.exe"];

#[cfg(all(target_os = "macos", target_arch = "aarch64"))]
const PREFERRED_ASSET_SUFFIXES: &[&str] = &["_aarch64.dmg"];

#[cfg(all(target_os = "macos", target_arch = "x86_64"))]
const PREFERRED_ASSET_SUFFIXES: &[&str] = &["_x64.dmg"];

#[cfg(target_os = "android")]
const PREFERRED_ASSET_SUFFIXES: &[&str] = &["_universal.apk"];

#[cfg(not(any(
    all(target_os = "linux", target_arch = "x86_64"),
    all(target_os = "windows", target_arch = "x86_64"),
    all(target_os = "macos", target_arch = "aarch64"),
    all(target_os = "macos", target_arch = "x86_64"),
    target_os = "android"
)))]
const PREFERRED_ASSET_SUFFIXES: &[&str] = &[];

fn preferred_asset_url(assets: &[GithubAsset]) -> Option<String> {
    PREFERRED_ASSET_SUFFIXES.iter().find_map(|suffix| {
        assets
            .iter()
            .find(|asset| asset.name.ends_with(suffix))
            .map(|asset| asset.browser_download_url.clone())
    })
}

#[tauri::command]
pub async fn check_github_release() -> Result<Option<LatestRelease>, String> {
    let client = reqwest::Client::builder()
        .user_agent("LexiKeep")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.get(GITHUB_API).send().await.map_err(|e| e.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    let release: GithubRelease = response.json().await.map_err(|e| e.to_string())?;
    let download_url =
        preferred_asset_url(&release.assets).unwrap_or_else(|| RELEASE_URL.to_string());

    Ok(Some(LatestRelease {
        version: release.tag_name.trim_start_matches('v').to_string(),
        url: download_url,
        published_at: release.published_at,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selects_the_installer_for_the_compiled_platform() {
        let assets = vec![
            GithubAsset {
                name: "LexiKeep_1.2.3_amd64.deb".into(),
                browser_download_url: "https://example.test/linux.deb".into(),
            },
            GithubAsset {
                name: "LexiKeep_1.2.3_x64-setup.exe".into(),
                browser_download_url: "https://example.test/windows.exe".into(),
            },
            GithubAsset {
                name: "LexiKeep_1.2.3_aarch64.dmg".into(),
                browser_download_url: "https://example.test/macos-arm.dmg".into(),
            },
            GithubAsset {
                name: "LexiKeep_1.2.3_x64.dmg".into(),
                browser_download_url: "https://example.test/macos-intel.dmg".into(),
            },
            GithubAsset {
                name: "LexiKeep_1.2.3_universal.apk".into(),
                browser_download_url: "https://example.test/android.apk".into(),
            },
        ];

        let selected = preferred_asset_url(&assets);
        if PREFERRED_ASSET_SUFFIXES.is_empty() {
            assert_eq!(selected, None);
        } else {
            assert!(selected.is_some());
            assert!(assets.iter().any(|asset| {
                Some(asset.browser_download_url.as_str()) == selected.as_deref()
                    && PREFERRED_ASSET_SUFFIXES
                        .iter()
                        .any(|suffix| asset.name.ends_with(suffix))
            }));
        }
    }
}
