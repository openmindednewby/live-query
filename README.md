# @dloizides/live-query

Live data in one hook: fetch once, take pushed updates over a SignalR WebSocket topic, poll while the socket is down.

```ts
import { createSignalRTransport, useLiveQuery } from '@dloizides/live-query';

const transport = createSignalRTransport({ url: '/api/live' });

const { data, error, isLoading, isLive, refresh } = useLiveQuery({
  topic: 'dashboard.stats',
  fetcher: (signal) => fetch('/api/stats', { signal }).then((r) => r.json()),
  transport,
  pollIntervalMs: 30_000,
});
```

- `transport` is optional; without one the hook only polls.
- One socket per transport, shared by every hook that uses it; it closes when the last hook unmounts.
- The server side is `Dloizides.Realtime.AspNetCore` (messages `{ topic, payload }` on method `live`).
