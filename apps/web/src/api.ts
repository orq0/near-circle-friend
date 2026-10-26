// Minimal API client for Phase 1. Never throws: any failure means "unreachable".
export async function fetchApiHealth(timeoutMs = 3000): Promise<boolean> {
  const base = import.meta.env.VITE_API_URL?.trim() ?? '';
  const url = base === '' ? '/api/health' : `${base.replace(/\/$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: unknown };
    return body.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
