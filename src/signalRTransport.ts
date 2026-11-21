import { HttpTransportType, HubConnectionBuilder, HubConnectionState, type HubConnection } from '@microsoft/signalr';

import type { LiveMessage, LiveMessageListener, LiveStatusListener, LiveTransport } from './types';

export const LIVE_METHOD = 'live';

const DEFAULT_RETRY_MS = 30_000;

export interface SignalRTransportOptions {
  url: string;
  retryMs?: number;
  createConnection?: (url: string) => HubConnection;
}

function createDefaultConnection(url: string): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(url, { transport: HttpTransportType.WebSockets, skipNegotiation: true, withCredentials: true })
    .withAutomaticReconnect()
    .build();
}

/** One shared SignalR WebSocket per url, fanned out by topic; reconnects and retries on its own. */
export function createSignalRTransport(options: SignalRTransportOptions): LiveTransport {
  const topics = new Map<string, Set<LiveMessageListener>>();
  const statuses = new Set<LiveStatusListener>();
  let connection: HubConnection | null = null;
  let isLive = false;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const setLive = (next: boolean): void => {
    isLive = next;
    statuses.forEach((listener) => listener(next));
  };

  const scheduleRetry = (): void => {
    if (statuses.size === 0 || retry !== undefined) return;
    retry = setTimeout(() => {
      retry = undefined;
      if (connection?.state === HubConnectionState.Disconnected) start();
    }, options.retryMs ?? DEFAULT_RETRY_MS);
  };

  const start = (): void => {
    if (connection === null) {
      const created = (options.createConnection ?? createDefaultConnection)(options.url);
      created.on(LIVE_METHOD, (message: LiveMessage) => topics.get(message.topic)?.forEach((listener) => listener(message.payload)));
      created.onreconnecting(() => setLive(false));
      created.onreconnected(() => setLive(true));
      created.onclose(() => {
        setLive(false);
        scheduleRetry();
      });
      connection = created;
    }
    connection.start().then(
      () => setLive(true),
      () => {
        setLive(false);
        scheduleRetry();
      },
    );
  };

  const stop = (): void => {
    clearTimeout(retry);
    retry = undefined;
    const current = connection;
    connection = null;
    isLive = false;
    void current?.stop();
  };

  return {
    subscribe(topic, onMessage, onStatus) {
      const listeners = topics.get(topic) ?? new Set<LiveMessageListener>();
      listeners.add(onMessage);
      topics.set(topic, listeners);
      statuses.add(onStatus);
      if (connection === null) start();
      else onStatus(isLive);
      return () => {
        listeners.delete(onMessage);
        if (listeners.size === 0) topics.delete(topic);
        statuses.delete(onStatus);
        if (statuses.size === 0) stop();
      };
    },
  };
}
