import { HubConnectionState, type HubConnection } from '@microsoft/signalr';
import { describe, expect, it, vi } from 'vitest';

import { createSignalRTransport, LIVE_METHOD } from './signalRTransport';

const RETRY_MS = 500;

function fakeConnection(start: () => Promise<void>) {
  const handlers = new Map<string, (message: unknown) => void>();
  const connection = {
    state: HubConnectionState.Disconnected,
    on: (method: string, handler: (message: unknown) => void) => handlers.set(method, handler),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
    start: vi.fn(start),
    stop: vi.fn().mockResolvedValue(undefined),
  };
  return { connection, deliver: (message: unknown) => handlers.get(LIVE_METHOD)?.(message) };
}

describe('createSignalRTransport', () => {
  it('routes a message only to listeners of its topic', async () => {
    const fake = fakeConnection(() => Promise.resolve());
    const transport = createSignalRTransport({ url: '/live', createConnection: () => fake.connection as unknown as HubConnection });
    const stats = vi.fn();
    const other = vi.fn();
    transport.subscribe('stats', stats, vi.fn());
    transport.subscribe('other', other, vi.fn());

    fake.deliver({ topic: 'stats', payload: { total: 1 } });

    expect(stats).toHaveBeenCalledWith({ total: 1 });
    expect(other).not.toHaveBeenCalled();
  });

  it('reports live after the socket starts', async () => {
    const fake = fakeConnection(() => Promise.resolve());
    const transport = createSignalRTransport({ url: '/live', createConnection: () => fake.connection as unknown as HubConnection });
    const status = vi.fn();

    transport.subscribe('stats', vi.fn(), status);

    await vi.waitFor(() => expect(status).toHaveBeenCalledWith(true));
    expect(fake.connection.start).toHaveBeenCalledTimes(1);
  });

  it('reports not live and retries when the socket cannot start', async () => {
    vi.useFakeTimers();
    const fake = fakeConnection(() => Promise.reject(new Error('refused')));
    const transport = createSignalRTransport({ url: '/live', retryMs: RETRY_MS, createConnection: () => fake.connection as unknown as HubConnection });
    const status = vi.fn();
    transport.subscribe('stats', vi.fn(), status);

    await vi.advanceTimersByTimeAsync(RETRY_MS);

    expect(status).toHaveBeenCalledWith(false);
    expect(fake.connection.start).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('stops the socket when the last subscriber leaves', () => {
    const fake = fakeConnection(() => Promise.resolve());
    const transport = createSignalRTransport({ url: '/live', createConnection: () => fake.connection as unknown as HubConnection });
    const unsubscribe = transport.subscribe('stats', vi.fn(), vi.fn());

    unsubscribe();

    expect(fake.connection.stop).toHaveBeenCalledTimes(1);
  });
});
