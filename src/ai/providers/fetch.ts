/**
 * Shared HTTP fetch with retry and exponential backoff
 */

import type { ProviderContext } from '../types.js';

/**
 * Fetch with retry, timeout, and exponential backoff.
 * Errors are enriched with URL and attempt info so "fetch failed"
 * messages always carry the API endpoint and retry count.
 */
export async function fetchWithRetry(
  ctx: Pick<ProviderContext, 'timeout' | 'maxRetries'>,
  url: string,
  options: RequestInit
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= ctx.maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ctx.timeout * 1000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      // Read error body for detailed error message
      let errorDetail = '';
      try {
        const body = await response.text();
        const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
        errorDetail = parsed.error?.message || parsed.message || body.slice(0, 200);
      } catch {
        errorDetail = response.statusText;
      }

      lastError = new Error(
        `[${url}] HTTP ${response.status}: ${errorDetail} (attempt ${attempt + 1}/${ctx.maxRetries + 1})`
      );

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        throw lastError;
      }
    } catch (error) {
      // Preserve the structured HTTP error thrown above
      if (error instanceof Error && error.message.startsWith(`[${url}] HTTP 4`)) {
        throw error;
      }

      const cause = error instanceof Error ? error.message : String(error);

      // Don't retry on DNS / resolution / TLS errors
      if (
        cause.includes('ENOTFOUND') ||
        cause.includes('ENODATA') ||
        cause.includes('ECONNREFUSED') ||
        cause.includes('EPROTO') ||
        cause.includes('CERT_') ||
        cause.includes('ERR_TLS') ||
        cause.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') ||
        cause.includes('DEPTH_ZERO_SELF_SIGNED_CERT')
      ) {
        throw new Error(`[${url}] ${cause}`);
      }

      lastError = new Error(`[${url}] ${cause} (attempt ${attempt + 1}/${ctx.maxRetries + 1})`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (attempt < ctx.maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 1000));
    }
  }

  throw lastError ?? new Error(`[${url}] Request failed`);
}
