import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './client';
import { useStore } from '../state/store';

/** Loads data from the API with the current login, with reload and error state. */
export function useApi<T>(fn: (token: string) => Promise<T>, deps: unknown[] = []) {
  const { state, dispatch } = useStore();
  const token = state.account?.token ?? null;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setData(await fnRef.current(token));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) dispatch({ type: 'logout' });
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dispatch, ...deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, setData, error, loading, reload, token };
}

export type Attempt<T> = { ok: true; value: T } | { ok: false };

/** Runs an API action and turns failures into a readable message. */
export async function attempt<T>(fn: () => Promise<T>, onError: (msg: string) => void): Promise<Attempt<T>> {
  try {
    return { ok: true, value: await fn() };
  } catch (e) {
    onError(e instanceof Error ? e.message : 'Something went wrong.');
    return { ok: false };
  }
}
