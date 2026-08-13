import type { DomainModelResult } from '../types.js';

/**
 * Calls a domain (organ) FastAPI service and ALWAYS resolves to a
 * DomainModelResult — never throws, never leaves a modality silently
 * missing. A timeout or network error becomes an explicit status the
 * fusion service can discount confidence for, per section 4 of the spec.
 */
export async function callDomainService(
  serviceUrl: string,
  modelId: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<DomainModelResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${serviceUrl}/infer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model_id: modelId, ...payload }),
      signal: controller.signal,
    });

    if (!res.ok) {
      return { model_id: modelId, status: 'error' };
    }

    const body = (await res.json()) as DomainModelResult;
    // Defensive: trust the service's status field, don't assume 'ok'.
    // model_id is set from our own call, not trusted from the response.
    return { ...body, model_id: modelId };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return { model_id: modelId, status: isAbort ? 'timeout' : 'error' };
  } finally {
    clearTimeout(timer);
  }
}
