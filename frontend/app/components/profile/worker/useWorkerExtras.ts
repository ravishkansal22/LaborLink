'use client';

/**
 * Local-only worker profile extras under `laborlink.profile.v1.worker-<id>`.
 * Never shares a key with employer `emp-<phone>` extras.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  clearExtras,
  loadExtras,
  saveExtras,
  type ProfileExtras,
} from '../../../lib/profile';

export function workerExtrasKey(workerId: string): string {
  return `worker-${workerId}`;
}

export function useWorkerExtras(workerId: string) {
  const userKey = workerExtrasKey(workerId);
  const [extras, setExtras] = useState<ProfileExtras | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setExtras(loadExtras(userKey));
    setReady(true);
  }, [userKey]);

  const persist = useCallback(
    (next: ProfileExtras | null) => {
      if (next) saveExtras(userKey, next);
      else clearExtras(userKey);
      setExtras(next);
    },
    [userKey],
  );

  const resetExtras = useCallback(() => {
    persist(null);
  }, [persist]);

  return { extras, ready, persist, resetExtras, userKey };
}
