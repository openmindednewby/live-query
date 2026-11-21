import type { LiveMessageListener, LiveStatusListener, LiveTransport } from './types';

export class FakeTransport implements LiveTransport {
  readonly topics = new Map<string, LiveMessageListener>();
  private readonly statuses = new Set<LiveStatusListener>();

  subscribe(topic: string, onMessage: LiveMessageListener, onStatus: LiveStatusListener): () => void {
    this.topics.set(topic, onMessage);
    this.statuses.add(onStatus);
    return () => {
      this.topics.delete(topic);
      this.statuses.delete(onStatus);
    };
  }

  push(topic: string, payload: unknown): void {
    this.topics.get(topic)?.(payload);
  }

  setLive(isLive: boolean): void {
    this.statuses.forEach((listener) => listener(isLive));
  }
}
