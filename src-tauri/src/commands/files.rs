use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::db::DbState;

#[derive(Serialize)]
pub struct FileInfo {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub imported_at: i64,
    pub segment_count: i64,
    pub phrase_analyzed: bool,
    pub phrase_analysis_at: Option<i64>,
    pub language: String,
    pub folder_id: Option<i64>,
}

#[derive(Serialize)]
pub struct FolderInfo {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub created_at: i64,
    pub file_count: i64,
}

#[derive(Serialize)]
pub struct SegmentInfo {
    pub id: i64,
    pub index_num: i32,
    pub en_text: String,
    pub zh_text: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
}

#[tauri::command]
pub fn list_files(
    state: State<DbState>,
    language: Option<String>,
    folder_id: Option<i64>,
    include_all_folders: Option<bool>,
) -> Result<Vec<FileInfo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    query_files(
        &conn,
        language.as_deref(),
        folder_id,
        include_all_folders.unwrap_or(false),
    )
    .map_err(|e| e.to_string())
}

fn query_files(
    conn: &rusqlite::Connection,
    language: Option<&str>,
    folder_id: Option<i64>,
    include_all_folders: bool,
) -> Result<Vec<FileInfo>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.name, f.type, f.imported_at, COUNT(s.id) AS segment_count,
                    f.language,
                    EXISTS(SELECT 1 FROM file_phrase_analysis a WHERE a.file_id = f.id) AS phrase_analyzed,
                    (SELECT completed_at FROM file_phrase_analysis a WHERE a.file_id = f.id) AS phrase_analysis_at,
                    f.folder_id
             FROM files f
             LEFT JOIN segments s ON s.file_id = f.id
             WHERE (?1 IS NULL OR f.language = ?1)
               AND (?3 OR ((?2 IS NULL AND f.folder_id IS NULL) OR f.folder_id = ?2))
             GROUP BY f.id
             ORDER BY f.imported_at DESC",
    )?;

    let rows = stmt.query_map(
        params![language, folder_id, include_all_folders],
        |row| {
            Ok(FileInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                file_type: row.get(2)?,
                imported_at: row.get(3)?,
                segment_count: row.get(4)?,
                phrase_analyzed: row.get::<_, i32>(6)? != 0,
                language: row.get(5)?,
                phrase_analysis_at: row.get(7)?,
                folder_id: row.get(8)?,
            })
        },
    )?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

#[tauri::command]
pub fn list_folders(state: State<DbState>, language: Option<String>) -> Result<Vec<FolderInfo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT fo.id, fo.name, fo.parent_id, fo.created_at, COUNT(f.id) AS file_count
             FROM folders fo
             LEFT JOIN files f ON f.folder_id = fo.id AND (?1 IS NULL OR f.language = ?1)
             GROUP BY fo.id
             ORDER BY fo.created_at, fo.id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![language.as_deref()], |row| {
            Ok(FolderInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                created_at: row.get(3)?,
                file_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn create_folder(
    state: State<DbState>,
    name: String,
    parent_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("folder name cannot be empty".to_string());
    }
    conn.execute(
        "INSERT INTO folders (name, parent_id, created_at) VALUES (?1, ?2, ?3)",
        params![trimmed, parent_id, now_ms()],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn rename_folder(state: State<DbState>, folder_id: i64, name: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("folder name cannot be empty".to_string());
    }
    conn.execute(
        "UPDATE folders SET name = ?1 WHERE id = ?2",
        params![trimmed, folder_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn folder_subtree_ids(conn: &rusqlite::Connection, folder_id: i64) -> Result<Vec<i64>, String> {
    let mut stmt = conn
        .prepare(
            "WITH RECURSIVE subtree(id) AS (
                 SELECT ?1
                 UNION ALL
                 SELECT fo.id FROM folders fo JOIN subtree s ON fo.parent_id = s.id
             )
             SELECT id FROM subtree",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![folder_id], |row| row.get::<_, i64>(0))
        .map_err(|e| e.to_string())?;

    let mut ids = Vec::new();
    for row in rows {
        ids.push(row.map_err(|e| e.to_string())?);
    }
    Ok(ids)
}

#[tauri::command]
pub fn delete_folder(state: State<DbState>, folder_id: i64) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let ids = folder_subtree_ids(&conn, folder_id)?;

    let mut file_stmt = conn
        .prepare("UPDATE files SET folder_id = NULL WHERE folder_id = ?1")
        .map_err(|e| e.to_string())?;
    for id in &ids {
        file_stmt.execute(params![id]).map_err(|e| e.to_string())?;
    }

    let mut folder_stmt = conn
        .prepare("DELETE FROM folders WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    for id in &ids {
        folder_stmt.execute(params![id]).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn move_folder(
    state: State<DbState>,
    folder_id: i64,
    target_parent_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    if let Some(target) = target_parent_id {
        if folder_id == target {
            return Err("cannot move a folder into itself".to_string());
        }
        let descendants = folder_subtree_ids(&conn, folder_id)?;
        if descendants.contains(&target) {
            return Err("cannot move a folder into its own descendant".to_string());
        }
    }

    conn.execute(
        "UPDATE folders SET parent_id = ?1 WHERE id = ?2",
        params![target_parent_id, folder_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn move_file(
    state: State<DbState>,
    file_id: i64,
    folder_id: Option<i64>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE files SET folder_id = ?1 WHERE id = ?2",
        params![folder_id, file_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

#[tauri::command]
pub fn delete_file(state: State<DbState>, file_id: i64) -> Result<(), String> {
    let mut conn = state.conn.lock().map_err(|e| e.to_string())?;

    delete_file_data(&mut conn, file_id).map_err(|e| e.to_string())
}

fn delete_file_data(
    conn: &mut rusqlite::Connection,
    file_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute_batch("PRAGMA foreign_keys = ON")?;
    let tx = conn.transaction()?;

    // A word belongs to the union of all imported files. Remove words that
    // occur in the deleted file only, while retaining words referenced by any
    // other file together with their status, definition, and review history.
    tx.execute(
        "DELETE FROM words
         WHERE id IN (
             SELECT o.word_id
             FROM occurrences o
             JOIN segments s ON s.id = o.segment_id
             WHERE s.file_id = ?1
         )
         AND NOT EXISTS (
             SELECT 1
             FROM occurrences other_o
             JOIN segments other_s ON other_s.id = other_o.segment_id
             WHERE other_o.word_id = words.id
               AND other_s.file_id <> ?1
         )",
        params![file_id],
    )?;
    tx.execute("DELETE FROM files WHERE id = ?1", params![file_id])?;
    tx.commit()?;

    Ok(())
}

#[tauri::command]
pub fn get_file_segments(state: State<DbState>, file_id: i64) -> Result<Vec<SegmentInfo>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, index_num, en_text, zh_text, start_time, end_time
             FROM segments
             WHERE file_id = ?1
             ORDER BY index_num",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![file_id], |row| {
            Ok(SegmentInfo {
                id: row.get(0)?,
                index_num: row.get(1)?,
                en_text: row.get(2)?,
                zh_text: row.get(3)?,
                start_time: row.get(4)?,
                end_time: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::{delete_file_data, query_files};
    use rusqlite::Connection;

    fn file_list_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE files (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                imported_at INTEGER NOT NULL,
                language TEXT NOT NULL,
                folder_id INTEGER
            );
            CREATE TABLE folders (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY,
                file_id INTEGER NOT NULL
            );
            CREATE TABLE file_phrase_analysis (
                file_id INTEGER PRIMARY KEY,
                completed_at INTEGER NOT NULL
            );
            INSERT INTO folders (id, name) VALUES (10, 'Folder');
            INSERT INTO files (id, name, type, imported_at, language, folder_id) VALUES
                (1, 'Root English', 'txt', 1, 'en', NULL),
                (2, 'Nested English', 'txt', 2, 'en', 10),
                (3, 'Nested Japanese', 'srt', 3, 'ja', 10);",
        )
        .unwrap();
        conn
    }

    fn deletion_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
            CREATE TABLE files (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE segments (
                id INTEGER PRIMARY KEY,
                file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE
            );
            CREATE TABLE words (
                id INTEGER PRIMARY KEY,
                lemma TEXT NOT NULL
            );
            CREATE TABLE occurrences (
                id INTEGER PRIMARY KEY,
                word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
                segment_id INTEGER NOT NULL REFERENCES segments(id) ON DELETE CASCADE
            );
            CREATE TABLE reviews (
                word_id INTEGER PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
                state INTEGER NOT NULL
            );
            INSERT INTO files (id, name) VALUES (1, 'Delete me'), (2, 'Keep me');
            INSERT INTO segments (id, file_id) VALUES (11, 1), (22, 2);
            INSERT INTO words (id, lemma) VALUES
                (101, 'only-deleted-file'),
                (102, 'shared-word'),
                (103, 'other-file-only');
            INSERT INTO occurrences (id, word_id, segment_id) VALUES
                (1, 101, 11),
                (2, 102, 11),
                (3, 102, 22),
                (4, 103, 22);
            INSERT INTO reviews (word_id, state) VALUES (101, 1), (102, 2), (103, 3);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn list_files_keeps_folder_browsing_scoped() {
        let conn = file_list_db();

        let root = query_files(&conn, None, None, false).unwrap();
        assert_eq!(root.iter().map(|file| file.id).collect::<Vec<_>>(), vec![1]);

        let folder = query_files(&conn, None, Some(10), false).unwrap();
        assert_eq!(
            folder.iter().map(|file| file.id).collect::<Vec<_>>(),
            vec![3, 2]
        );
    }

    #[test]
    fn list_files_can_include_every_folder_for_reading() {
        let conn = file_list_db();

        let all = query_files(&conn, None, None, true).unwrap();
        assert_eq!(
            all.iter().map(|file| file.id).collect::<Vec<_>>(),
            vec![3, 2, 1]
        );

        let english = query_files(&conn, Some("en"), None, true).unwrap();
        assert_eq!(
            english.iter().map(|file| file.id).collect::<Vec<_>>(),
            vec![2, 1]
        );
    }

    #[test]
    fn deleting_a_file_removes_only_words_without_other_file_occurrences() {
        let mut conn = deletion_db();

        delete_file_data(&mut conn, 1).unwrap();

        let file_ids = conn
            .prepare("SELECT id FROM files ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get::<_, i64>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(file_ids, vec![2]);

        let word_ids = conn
            .prepare("SELECT id FROM words ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get::<_, i64>(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(word_ids, vec![102, 103]);

        let shared_review_state: i64 = conn
            .query_row("SELECT state FROM reviews WHERE word_id = 102", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(shared_review_state, 2);

        let deleted_review_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM reviews WHERE word_id = 101", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(deleted_review_count, 0);
    }
}
