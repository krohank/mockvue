/**
 * fetch() with a hard timeout that actually aborts the request (a bare
 * Promise.race leaves the socket open and the timer running).
 */
export const fetchJSON = async (url, { timeoutMs = 20000, signal, ...init } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener?.('abort', onAbort, { once: true });

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      const err = new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
      err.status = response.status;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Provider returned non-JSON body: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    if (controller.signal.aborted && controller.signal.reason instanceof Error) {
      throw controller.signal.reason;
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', onAbort);
  }
};
