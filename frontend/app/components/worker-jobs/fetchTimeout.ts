/**
 * Race a promise against an AbortController timeout (default 8 s).
 * Does not cancel the underlying fetch (api client has no signal hook),
 * but fails the screen load promptly when the backend is slow/offline.
 */

import { ApiError } from '../../lib/api';

export const LIST_FETCH_TIMEOUT_MS = 8000;

export function withTimeout<T>(promise: Promise<T>, ms = LIST_FETCH_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ApiError(
          0,
          'timeout',
          'This is taking too long. Check that the LaborLink server is running, then try again.',
        ),
      );
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
