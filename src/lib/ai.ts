import { invoke } from '@tauri-apps/api/core';
import { useAiStore } from '../stores/aiStore';
import { resolveAiBaseUrl, type AiProvider } from './aiProviders';

export interface AiConfig {
  provider: AiProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export function getAiConfig(): AiConfig {
  const { provider, baseUrl, model, apiKey } = useAiStore.getState();
  return {
    provider,
    baseUrl: resolveAiBaseUrl(provider, baseUrl),
    model,
    apiKey,
  };
}

export function isAiEnabled(): boolean {
  return useAiStore.getState().enabled;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function aiModelsEndpoint(config: AiConfig): string {
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, '');
  if (config.provider === 'openai') return `${baseUrl}/models`;
  return `${baseUrl.replace(/\/api$/, '')}/api/tags`;
}

async function fetchAiModels(config: AiConfig): Promise<{ name: string }[]> {
  const url = aiModelsEndpoint(config);
  const headers = new Headers();
  if (config.provider === 'openai' && config.apiKey?.trim()) {
    headers.set('Authorization', `Bearer ${config.apiKey.trim()}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new Error(`无法连接 AI 服务（${url}）：${String(error)}`);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 500);
    throw new Error(`AI 服务返回错误 HTTP ${response.status}${detail ? `：${detail}` : ''}`);
  }

  const result = await response.json() as {
    data?: { id?: string }[];
    models?: { name?: string }[];
  };
  const names = config.provider === 'openai'
    ? (result.data ?? []).map((model) => model.id)
    : (result.models ?? []).map((model) => model.name);
  return names
    .filter((name): name is string => Boolean(name?.trim()))
    .map((name) => ({ name }));
}

/** Connects to the configured service and returns every selectable model. */
export async function connectAndLoadAiModels(config: AiConfig): Promise<{ name: string }[]> {
  if (!isTauriRuntime()) return fetchAiModels(config);

  await invoke('ai_status', { config });
  return invoke<{ name: string }[]>('ai_models', { config });
}
