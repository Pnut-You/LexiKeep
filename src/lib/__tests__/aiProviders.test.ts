import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLOUD_PRESET,
  DEFAULT_OLLAMA_URL,
  findAiPresetByBaseUrl,
  findAiPresetByKey,
  isOllamaBaseUrl,
  normalizeAiBaseUrl,
  resolveAiBaseUrl,
  shouldMigrateBrokenCloudConfig,
} from '../aiProviders';

describe('AI provider presets', () => {
  it('uses Qwen China as the default cloud service', () => {
    expect(DEFAULT_CLOUD_PRESET.key).toBe('qwen-cn');
    expect(DEFAULT_CLOUD_PRESET.baseUrl).toBe(
      'https://dashscope.aliyuncs.com/compatible-mode/v1',
    );
    expect(DEFAULT_CLOUD_PRESET.defaultModel).toBe('qwen-plus');
  });

  it('resolves empty URLs without mixing cloud and Ollama endpoints', () => {
    expect(resolveAiBaseUrl('ollama', '')).toBe(DEFAULT_OLLAMA_URL);
    expect(resolveAiBaseUrl('openai', '')).toBe(DEFAULT_CLOUD_PRESET.baseUrl);
  });

  it('matches presets after normalizing trailing slashes', () => {
    const preset = findAiPresetByBaseUrl(`${DEFAULT_CLOUD_PRESET.baseUrl}///`);
    expect(preset?.key).toBe('qwen-cn');
    expect(findAiPresetByKey('qwen-intl')?.defaultModel).toBe('qwen-plus');
  });

  it('recognizes only the configured Ollama base URL', () => {
    expect(isOllamaBaseUrl('http://localhost:11434/')).toBe(true);
    expect(isOllamaBaseUrl(DEFAULT_CLOUD_PRESET.baseUrl)).toBe(false);
    expect(normalizeAiBaseUrl(' https://example.com/v1/// ')).toBe('https://example.com/v1');
  });

  it('detects cloud configurations accidentally left on Ollama', () => {
    expect(shouldMigrateBrokenCloudConfig('openai', DEFAULT_OLLAMA_URL)).toBe(true);
    expect(shouldMigrateBrokenCloudConfig('openai', '')).toBe(true);
    expect(shouldMigrateBrokenCloudConfig('openai', DEFAULT_CLOUD_PRESET.baseUrl)).toBe(false);
    expect(shouldMigrateBrokenCloudConfig('ollama', DEFAULT_OLLAMA_URL)).toBe(false);
  });
});
