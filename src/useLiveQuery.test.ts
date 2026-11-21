import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeTransport } from './fakeTransport.test-support';
import { useLiveQuery } from './useLiveQuery';

const POLL_MS = 1_000;

describe('useLiveQuery', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('returns the fetched value on mount', async () => {
    const fetcher = vi.fn().mockResolvedValue({ total: 3 });

    const { result } = renderHook(() => useLiveQuery({ topic: 'stats', fetcher }));

    await waitFor(() => expect(result.current.data).toEqual({ total: 3 }));
    expect(result.current.isLoading).toBe(false);
  });

  it('replaces the data with a payload pushed on its topic', async () => {
    const transport = new FakeTransport();
    const fetcher = vi.fn().mockResolvedValue({ total: 3 });
    const { result } = renderHook(() => useLiveQuery({ topic: 'stats', fetcher, transport }));
    await waitFor(() => expect(result.current.data).toEqual({ total: 3 }));

    act(() => transport.push('stats', { total: 9 }));

    expect(result.current.data).toEqual({ total: 9 });
  });

  it('ignores a payload pushed on another topic', async () => {
    const transport = new FakeTransport();
    const fetcher = vi.fn().mockResolvedValue({ total: 3 });
    const { result } = renderHook(() => useLiveQuery({ topic: 'stats', fetcher, transport }));
    await waitFor(() => expect(result.current.data).toEqual({ total: 3 }));

    act(() => transport.push('other', { total: 9 }));

    expect(result.current.data).toEqual({ total: 3 });
  });

  it('polls while the socket is down', async () => {
    const transport = new FakeTransport();
    const fetcher = vi.fn().mockResolvedValue({ total: 3 });
    renderHook(() => useLiveQuery({ topic: 'stats', fetcher, transport, pollIntervalMs: POLL_MS }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 2);
    });

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('stops polling once the socket is live', async () => {
    const transport = new FakeTransport();
    const fetcher = vi.fn().mockResolvedValue({ total: 3 });
    const { result } = renderHook(() => useLiveQuery({ topic: 'stats', fetcher, transport, pollIntervalMs: POLL_MS }));
    act(() => transport.setLive(true));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });

    expect(result.current.isLive).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps the error of a failed fetch', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useLiveQuery({ topic: 'stats', fetcher }));

    await waitFor(() => expect(result.current.error).toEqual(new Error('down')));
  });

  it('does not fetch while disabled', () => {
    const fetcher = vi.fn().mockResolvedValue({ total: 3 });

    renderHook(() => useLiveQuery({ topic: 'stats', fetcher, enabled: false }));

    expect(fetcher).not.toHaveBeenCalled();
  });
});
