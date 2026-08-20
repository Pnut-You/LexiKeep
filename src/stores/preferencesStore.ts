import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import type { Language, UILanguage } from '../lib/languages';
import { isLanguage, detectSystemLanguage, isUILanguage } from '../lib/languages';

export type ReadingFontSize = 'sm' | 'md' | 'lg';
export type ReadingLineHeight = 'compact' | 'normal' | 'loose';
export type YoutubeCookieBrowser = 'none' | 'firefox' | 'chrome' | 'chromium' | 'edge' | 'brave';

const FONT_SIZES: ReadingFontSize[] = ['sm', 'md', 'lg'];
const LINE_HEIGHTS: ReadingLineHeight[] = ['compact', 'normal', 'loose'];
const YOUTUBE_COOKIE_BROWSERS: YoutubeCookieBrowser[] = ['none', 'firefox', 'chrome', 'chromium', 'edge', 'brave'];

interface PreferencesState {
  language: Language | 'all';
  setLanguage: (language: Language | 'all') => void;
  uiLanguage: UILanguage;
  setUiLanguage: (language: UILanguage) => void;
  readingFontSize: ReadingFontSize;
  setReadingFontSize: (size: ReadingFontSize) => void;
  readingLineHeight: ReadingLineHeight;
  setReadingLineHeight: (lineHeight: ReadingLineHeight) => void;
  youtubeCookieBrowser: YoutubeCookieBrowser;
  setYoutubeCookieBrowser: (browser: YoutubeCookieBrowser) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        language: 'all',
        setLanguage: (language) => set({ language }),
        uiLanguage: detectSystemLanguage(),
        setUiLanguage: (language) => set({ uiLanguage: language }),
        readingFontSize: 'md',
        setReadingFontSize: (size) => set({ readingFontSize: size }),
        readingLineHeight: 'normal',
        setReadingLineHeight: (lineHeight) => set({ readingLineHeight: lineHeight }),
        youtubeCookieBrowser: 'none',
        setYoutubeCookieBrowser: (browser) => set({ youtubeCookieBrowser: browser }),
      }),
      {
        // Persist under the legacy key so upgrades keep existing preferences.
        name: 'lexicue-preferences',
        storage: createJSONStorage(() => localStorage),
        merge: (persisted, current) => {
          const saved = (persisted ?? {}) as {
            language?: unknown;
            uiLanguage?: unknown;
            readingFontSize?: unknown;
            readingLineHeight?: unknown;
            youtubeCookieBrowser?: unknown;
          };
          const language = typeof saved.language === 'string' && isLanguage(saved.language)
            ? saved.language
            : current.language;
          const uiLanguage = isUILanguage(saved.uiLanguage)
            ? saved.uiLanguage
            : current.uiLanguage;
          const readingFontSize = FONT_SIZES.includes(saved.readingFontSize as ReadingFontSize)
            ? saved.readingFontSize as ReadingFontSize
            : current.readingFontSize;
          const readingLineHeight = LINE_HEIGHTS.includes(saved.readingLineHeight as ReadingLineHeight)
            ? saved.readingLineHeight as ReadingLineHeight
            : current.readingLineHeight;
          const youtubeCookieBrowser = YOUTUBE_COOKIE_BROWSERS.includes(saved.youtubeCookieBrowser as YoutubeCookieBrowser)
            ? saved.youtubeCookieBrowser as YoutubeCookieBrowser
            : current.youtubeCookieBrowser;
          return { ...current, language, uiLanguage, readingFontSize, readingLineHeight, youtubeCookieBrowser };
        },
      },
    ),
  ),
);
