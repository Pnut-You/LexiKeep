import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  DEFAULT_CLOUD_PRESET,
  DEFAULT_OLLAMA_URL,
  OPENAI_PRESETS,
  normalizeAiBaseUrl,
  shouldMigrateBrokenCloudConfig,
  type AiPreset,
  type AiProvider,
} from '../lib/aiProviders';

export { DEFAULT_OLLAMA_URL, OPENAI_PRESETS };
export type { AiPreset, AiProvider };

export type AiConnectionStatus = 'idle' | 'checking' | 'ready' | 'error';

const LEGACY_BASE_URL_KEY = 'lexicue.ollama.baseUrl';
const LEGACY_MODEL_KEY = 'lexicue.ollama.model';

interface AiState {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  apiKeys: Record<string, string>;
  aiStatus: AiConnectionStatus;
  aiModels: string[];
  aiError: string;
  aiFingerprint: string;
  setEnabled: (enabled: boolean) => void;
  setProvider: (provider: AiProvider) => void;
  setBaseUrl: (baseUrl: string) => void;
  setModel: (model: string) => void;
  setApiKey: (apiKey: string) => void;
  selectBaseUrl: (baseUrl: string) => void;
  setAiStatus: (status: AiConnectionStatus) => void;
  setAiModels: (models: string[]) => void;
  setAiError: (error: string) => void;
  setAiFingerprint: (fingerprint: string) => void;
  resetAiCheck: () => void;
}

type PersistedAi = Partial<Omit<
  AiState,
  | 'setEnabled'
  | 'setProvider'
  | 'setBaseUrl'
  | 'setModel'
  | 'setApiKey'
  | 'selectBaseUrl'
  | 'setAiStatus'
  | 'setAiModels'
  | 'setAiError'
  | 'setAiFingerprint'
  | 'resetAiCheck'
>>;

export const useAiStore = create<AiState>()(
  persist(
    (set) => ({
      enabled: false,
      provider: 'ollama',
      baseUrl: DEFAULT_OLLAMA_URL,
      model: '',
      apiKey: '',
      apiKeys: {},
      aiStatus: 'idle',
      aiModels: [],
      aiError: '',
      aiFingerprint: '',
      setEnabled: (enabled) => set({ enabled }),
      setProvider: (provider) => set({ provider }),
      setBaseUrl: (baseUrl) => set((state) => {
        const currentUrl = normalizeAiBaseUrl(state.baseUrl);
        const nextUrl = normalizeAiBaseUrl(baseUrl);
        return {
          baseUrl,
          apiKey: currentUrl === nextUrl ? state.apiKey : state.apiKeys[nextUrl] ?? '',
        };
      }),
      setModel: (model) => set({ model }),
      setApiKey: (apiKey) => set((state) => ({
        apiKey,
        apiKeys: { ...state.apiKeys, [normalizeAiBaseUrl(state.baseUrl)]: apiKey },
      })),
      selectBaseUrl: (baseUrl) => set((state) => ({
        baseUrl,
        apiKey: state.apiKeys[normalizeAiBaseUrl(baseUrl)] ?? '',
      })),
      setAiStatus: (status) => set({ aiStatus: status }),
      setAiModels: (models) => set({ aiModels: models }),
      setAiError: (error) => set({ aiError: error }),
      setAiFingerprint: (fingerprint) => set({ aiFingerprint: fingerprint }),
      resetAiCheck: () => set({ aiStatus: 'idle', aiModels: [], aiError: '', aiFingerprint: '' }),
    }),
    {
      name: 'lexicue-ai',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as PersistedAi;
        const legacyBaseUrl = localStorage.getItem(LEGACY_BASE_URL_KEY);
        const legacyModel = localStorage.getItem(LEGACY_MODEL_KEY);
        const hasLegacy = Boolean(legacyBaseUrl || legacyModel);
        if (hasLegacy) {
          localStorage.removeItem(LEGACY_BASE_URL_KEY);
          localStorage.removeItem(LEGACY_MODEL_KEY);
        }
        const savedProvider: AiProvider = saved.provider === 'openai' ? 'openai' : 'ollama';
        const initialBaseUrl = typeof saved.baseUrl === 'string'
          ? saved.baseUrl
          : legacyBaseUrl ?? DEFAULT_OLLAMA_URL;
        const migrateBrokenCloudConfig = shouldMigrateBrokenCloudConfig(
          savedProvider,
          initialBaseUrl,
        );
        const baseUrl = migrateBrokenCloudConfig
          ? DEFAULT_CLOUD_PRESET.baseUrl
          : initialBaseUrl;
        const savedApiKey = typeof saved.apiKey === 'string' ? saved.apiKey : '';
        const apiKeys = saved.apiKeys && typeof saved.apiKeys === 'object'
          ? saved.apiKeys as Record<string, string>
          : (savedApiKey ? { [normalizeAiBaseUrl(initialBaseUrl)]: savedApiKey } : {});
        const apiKey = apiKeys[normalizeAiBaseUrl(baseUrl)]
          ?? (normalizeAiBaseUrl(baseUrl) === normalizeAiBaseUrl(initialBaseUrl) ? savedApiKey : '');
        const savedStatus = saved.aiStatus === 'ready' || saved.aiStatus === 'error'
          ? saved.aiStatus
          : 'idle';
        return {
          ...current,
          ...saved,
          enabled: typeof saved.enabled === 'boolean' ? saved.enabled : hasLegacy,
          provider: savedProvider,
          baseUrl,
          model: !migrateBrokenCloudConfig && typeof saved.model === 'string' && saved.model
            ? saved.model
            : (savedProvider === 'openai' && baseUrl === DEFAULT_CLOUD_PRESET.baseUrl
              ? DEFAULT_CLOUD_PRESET.defaultModel ?? ''
              : legacyModel ?? ''),
          apiKey,
          apiKeys,
          aiStatus: savedStatus,
          aiModels: Array.isArray(saved.aiModels) ? saved.aiModels : [],
          aiError: typeof saved.aiError === 'string' ? saved.aiError : '',
          aiFingerprint: typeof saved.aiFingerprint === 'string' ? saved.aiFingerprint : '',
        };
      },
    },
  ),
);
