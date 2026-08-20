import type { Language } from './languages';
import type { SubtitleTrack, VideoSubInfo } from '../stores/youtubeStore';

export interface SupportedYoutubeTrack {
  language: Language;
  track: SubtitleTrack;
}

export const SUPPORTED_YOUTUBE_LANGUAGES: Language[] = ['zh', 'ja', 'en', 'de'];

export function youtubeTrackLanguage(lang: string): Language | null {
  const base = lang.toLowerCase().split('-')[0];
  switch (base) {
    case 'en':
      return 'en';
    case 'ja':
    case 'jp':
      return 'ja';
    case 'de':
      return 'de';
    case 'zh':
      return 'zh';
    default:
      return null;
  }
}

function preferenceScore(track: SubtitleTrack, language: Language): number {
  const code = track.lang.toLowerCase();
  let score = track.is_auto ? 0 : 1_000;
  if (code.endsWith('-orig')) score += 200;
  if (code === language) score += 100;
  if (language === 'zh' && (code === 'zh-hans' || code === 'zh-cn')) score += 80;
  return score;
}

export function supportedYoutubeTracks(info: VideoSubInfo): SupportedYoutubeTrack[] {
  const tracks = [...info.manual, ...info.automatic];
  return SUPPORTED_YOUTUBE_LANGUAGES.flatMap((language) => {
    const candidates = tracks
      .filter((track) => youtubeTrackLanguage(track.lang) === language)
      .sort((a, b) => preferenceScore(b, language) - preferenceScore(a, language));
    return candidates[0] ? [{ language, track: candidates[0] }] : [];
  });
}

