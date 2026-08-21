import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { AiConfig } from '../lib/ai';
import i18n from '../i18n';
import { usePreferencesStore } from './preferencesStore';

function selectedCookieBrowser(): string | null {
  const browser = usePreferencesStore.getState().youtubeCookieBrowser;
  return browser === 'none' ? null : browser;
}

export interface SubtitleTrack {
  lang: string;
  is_auto: boolean;
}

export interface VideoSubInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  manual: SubtitleTrack[];
  automatic: SubtitleTrack[];
}

export interface SubtitleResult {
  name: string;
  content: string;
}

export interface YtDlpStatus {
  available: boolean;
  version: string | null;
}

export interface TrackSelection {
  lang: string;
  is_auto: boolean;
}

export interface SegmentTranslation {
  index: number;
  translation: string;
}

export interface TranslateProgress {
  jobId: number;
  status: 'processing' | 'completed' | 'error';
  processedSegments: number;
  totalSegments: number;
  percent: number;
  completedBatches?: number;
  totalBatches?: number;
}

export interface DownloadProgress {
  jobId: number;
  status: 'processing' | 'completed' | 'error';
  stage: string;
  percent: number;
  message: string;
}

interface YoutubeStore {
  translateProgress: Record<number, TranslateProgress>;
  downloadProgress: Record<number, DownloadProgress>;
  initialize: () => Promise<void>;
  listSubs: (url: string) => Promise<VideoSubInfo>;
  downloadSub: (jobId: number, url: string, lang: string, isAuto: boolean) => Promise<SubtitleResult>;
  mergeSubs: (jobId: number, url: string, primary: TrackSelection, secondary: TrackSelection) => Promise<SubtitleResult>;
  cancelJob: (jobId: number) => Promise<void>;
  translateSegments: (
    jobId: number,
    language: string,
    segments: Array<{ index: number; text: string }>,
    config: AiConfig,
  ) => Promise<SegmentTranslation[]>;
  cancelTranslate: (jobId: number) => Promise<void>;
  ytdlpStatus: () => Promise<YtDlpStatus>;
}

let initialized = false;
const activeTranslateJobs = new Set<number>();
const activeDownloadJobs = new Set<number>();

export const useYoutubeStore = create<YoutubeStore>((set) => ({
  translateProgress: {},
  downloadProgress: {},

  initialize: async () => {
    if (initialized) return;
    initialized = true;
    await listen<TranslateProgress>('translate-progress', (event) => {
      if (!activeTranslateJobs.has(event.payload.jobId)) return;
      set((state) => ({
        translateProgress: { ...state.translateProgress, [event.payload.jobId]: event.payload },
      }));
    });
    await listen<DownloadProgress>('youtube-progress', (event) => {
      if (!activeDownloadJobs.has(event.payload.jobId)) return;
      set((state) => ({
        downloadProgress: { ...state.downloadProgress, [event.payload.jobId]: event.payload },
      }));
    });
  },

  listSubs: async (url) => invoke('youtube_list_subs', { url, cookieBrowser: selectedCookieBrowser() }),

  downloadSub: async (jobId, url, lang, isAuto) => {
    activeDownloadJobs.add(jobId);
    set((state) => ({
      downloadProgress: {
        ...state.downloadProgress,
        [jobId]: {
          jobId,
          status: 'processing',
          stage: i18n.t('youtubeStore.stageParsing'),
          percent: 0,
          message: i18n.t('youtubeStore.downloading'),
        },
      },
    }));
    try {
      return await invoke<SubtitleResult>('youtube_download_sub', {
        jobId,
        url,
        lang,
        isAuto,
        cookieBrowser: selectedCookieBrowser(),
      });
    } finally {
      activeDownloadJobs.delete(jobId);
      set((state) => {
        const downloadProgress = { ...state.downloadProgress };
        delete downloadProgress[jobId];
        return { downloadProgress };
      });
    }
  },

  mergeSubs: async (jobId, url, primary, secondary) => {
    activeDownloadJobs.add(jobId);
    set((state) => ({
      downloadProgress: {
        ...state.downloadProgress,
        [jobId]: {
          jobId,
          status: 'processing',
          stage: i18n.t('youtubeStore.stageParsing'),
          percent: 0,
          message: i18n.t('youtubeStore.downloadingMerge'),
        },
      },
    }));
    try {
      return await invoke<SubtitleResult>('youtube_merge_subs', {
        jobId,
        url,
        primary,
        secondary,
        cookieBrowser: selectedCookieBrowser(),
      });
    } finally {
      activeDownloadJobs.delete(jobId);
      set((state) => {
        const downloadProgress = { ...state.downloadProgress };
        delete downloadProgress[jobId];
        return { downloadProgress };
      });
    }
  },

  cancelJob: async (jobId) => {
    await invoke('youtube_cancel_job', { jobId });
  },

  translateSegments: async (jobId, language, segments, config) => {
    activeTranslateJobs.add(jobId);
    set((state) => ({
      translateProgress: {
        ...state.translateProgress,
        [jobId]: {
          jobId,
          status: 'processing',
          processedSegments: 0,
          totalSegments: segments.length,
          percent: 0,
        },
      },
    }));
    try {
      return await invoke<SegmentTranslation[]>('translate_segments', {
        jobId,
        config,
        language,
        segments,
      });
    } finally {
      activeTranslateJobs.delete(jobId);
      set((state) => {
        const translateProgress = { ...state.translateProgress };
        delete translateProgress[jobId];
        return { translateProgress };
      });
    }
  },

  cancelTranslate: async (jobId) => {
    await invoke('cancel_translate_segments', { jobId });
  },

  ytdlpStatus: async () => invoke('youtube_ytdlp_status'),
}));
