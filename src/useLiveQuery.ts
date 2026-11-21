import { useCallback, useEffect, useRef, useState } from 'react';

import type { LiveTransport } from './types';

export const DEFAULT_POLL_MS = 30_000;

export interface UseLiveQueryOptions<T> {
  topic: string;
  fetcher: (signal: AbortSignal) => Promise<T>;
  transport?: LiveTransport | null;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export interface LiveQueryResult<T> {
  data: T | undefined;
  error: unknown;
  isLoading: boolean;
  isLive: boolean;
  refresh: () => void;
}

/** Fetches once, then takes pushed payloads for the topic; polls while the socket is down. */
export function useLiveQuery<T>(options: UseLiveQueryOptions<T>): LiveQueryResult<T> {
  const { topic, fetcher, transport = null, pollIntervalMs = DEFAULT_POLL_MS, enabled = true } = options;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isLive, setIsLive] = useState(false);
  const fetcherRef = useRef(fetcher);
  const controllerRef = useRef<AbortController | null>(null);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    fetcherRef.current(controller.signal).then(
      (value) => {
        if (controller.signal.aborted) return;
        setData(value);
        setError(undefined);
        setIsLoading(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason);
        setIsLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    return () => controllerRef.current?.abort();
  }, [enabled, topic, refresh]);

  useEffect(() => {
    if (!enabled || transport === null) return undefined;
    return transport.subscribe(
      topic,
      (payload) => {
        setData(payload as T);
        setError(undefined);
        setIsLoading(false);
      },
      setIsLive,
    );
  }, [enabled, transport, topic]);

  useEffect(() => {
    if (!enabled || isLive) return undefined;
    const timer = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(timer);
  }, [enabled, isLive, pollIntervalMs, refresh]);

  return { data, error, isLoading, isLive: enabled && isLive, refresh };
}
