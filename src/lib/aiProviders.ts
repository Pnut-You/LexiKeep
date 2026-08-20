export type AiProvider = 'ollama' | 'openai';

export type AiPresetKey =
  | 'qwen-cn'
  | 'qwen-intl'
  | 'openai'
  | 'deepseek'
  | 'opencode'
  | 'custom';

export interface AiPreset {
  key: AiPresetKey;
  label: string;
  baseUrl: string;
  defaultModel?: string;
}

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export const OPENAI_PRESETS: AiPreset[] = [
  {
    key: 'qwen-cn',
    label: 'Qwen (中国大陆)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  {
    key: 'qwen-intl',
    label: 'Qwen (International)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  { key: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { key: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { key: 'opencode', label: 'OpenCode', baseUrl: 'https://opencode.ai/zen/go/v1' },
  { key: 'custom', label: 'Custom', baseUrl: '' },
];

export const DEFAULT_CLOUD_PRESET = OPENAI_PRESETS[0];

export function normalizeAiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

export function findAiPresetByKey(key: string): AiPreset | undefined {
  return OPENAI_PRESETS.find((preset) => preset.key === key);
}

export function findAiPresetByBaseUrl(baseUrl: string): AiPreset | undefined {
  const normalized = normalizeAiBaseUrl(baseUrl);
  return OPENAI_PRESETS.find(
    (preset) => preset.key !== 'custom' && normalizeAiBaseUrl(preset.baseUrl) === normalized,
  );
}

export function resolveAiBaseUrl(provider: AiProvider, baseUrl: string): string {
  const normalized = normalizeAiBaseUrl(baseUrl);
  if (normalized) return normalized;
  return provider === 'openai' ? DEFAULT_CLOUD_PRESET.baseUrl : DEFAULT_OLLAMA_URL;
}

export function isOllamaBaseUrl(baseUrl: string): boolean {
  return normalizeAiBaseUrl(baseUrl) === normalizeAiBaseUrl(DEFAULT_OLLAMA_URL);
}

export function shouldMigrateBrokenCloudConfig(provider: AiProvider, baseUrl: string): boolean {
  return provider === 'openai'
    && (!normalizeAiBaseUrl(baseUrl) || isOllamaBaseUrl(baseUrl));
}
