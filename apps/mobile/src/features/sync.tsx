import { mergeSyncData, type SyncData } from '@reppilot/core';
import { useCallback, useEffect, useRef } from 'react';
import { AppState as RNAppState } from 'react-native';
import { ApiError, api } from '../api/client';
import { toSyncData, useStore, type AppState } from '../state/store';

const DEBOUNCE_MS = 2500;
const POLL_MS = 120_000;

function isSyncData(d: unknown): d is SyncData {
  return !!d && typeof d === 'object' && 'updatedAt' in d && Array.isArray((d as SyncData).logs);
}

/** Returns a function that backs up local data and pulls changes from other devices. */
export function useSyncNow() {
  const { state, dispatch } = useStore();
  const ref = useRef<AppState>(state);
  ref.current = state;
  const running = useRef(false);

  return useCallback(async () => {
    const s = ref.current;
    if (!s.account || running.current) return;
    running.current = true;
    const token = s.account.token;
    dispatch({ type: 'setSync', patch: { status: 'syncing', error: undefined } });
    try {
      let merged = toSyncData(s);
      let base = s.sync.version;
      const localChanged = !s.sync.lastSyncedAt || s.dataUpdatedAt > s.sync.lastSyncedAt;
      const remote = await api.getSync(token);
      if (remote.version !== base && isSyncData(remote.data)) {
        merged = base === 0 && !s.profile ? remote.data : mergeSyncData(merged, remote.data);
        base = remote.version;
      }
      if (!localChanged && remote.version === s.sync.version) {
        dispatch({ type: 'setSync', patch: { status: 'idle', lastSyncedAt: new Date().toISOString() } });
        return;
      }
      let saved;
      try {
        saved = await api.putSync(token, base, merged as unknown as Record<string, unknown>);
      } catch (e) {
        // Another device saved in between: merge once more and retry.
        const detail = e instanceof ApiError && e.status === 409 ? (e.detail as { version: number; data: unknown }) : null;
        if (!detail) throw e;
        if (isSyncData(detail.data)) merged = mergeSyncData(merged, detail.data);
        saved = await api.putSync(token, detail.version, merged as unknown as Record<string, unknown>);
      }
      dispatch({ type: 'applySynced', data: merged, version: saved.version });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        dispatch({ type: 'logout' });
        return;
      }
      dispatch({ type: 'setSync', patch: { status: 'error', error: e instanceof Error ? e.message : 'Sync failed' } });
    } finally {
      running.current = false;
    }
  }, [dispatch]);
}

/** Keeps the account backup up to date in the background. Renders nothing. */
export function AutoSync() {
  const { state } = useStore();
  const syncNow = useSyncNow();
  const token = state.account?.token;

  useEffect(() => {
    if (!token) return;
    const t = setTimeout(syncNow, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [token, state.dataUpdatedAt, syncNow]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(syncNow, POLL_MS);
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [token, syncNow]);

  return null;
}
