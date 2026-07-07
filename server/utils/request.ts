import { HttpError } from '../errors';

export async function readJsonBody(request: Request, maxBodyBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new HttpError(413, '请求体过大');
  }

  if (!request.body) {
    return {};
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      if (value) {
        receivedBytes += value.byteLength;
        if (receivedBytes > maxBodyBytes) {
          throw new HttpError(413, '请求体过大');
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks.map(chunk => Buffer.from(chunk))).toString('utf-8');

  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'malformed JSON');
  }
}

export function ensureObjectPayload(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new HttpError(400, '请求体必须是 JSON 对象');
  }

  return payload as Record<string, unknown>;
}

export function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `缺少 ${fieldName}`);
  }

  return value.trim();
}
