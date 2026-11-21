export type LiveMessageListener = (payload: unknown) => void;

export type LiveStatusListener = (isLive: boolean) => void;

export interface LiveMessage {
  topic: string;
  payload: unknown;
}

/** A push channel: subscribe to one topic, get its payloads and the socket state; returns the unsubscribe. */
export interface LiveTransport {
  subscribe(topic: string, onMessage: LiveMessageListener, onStatus: LiveStatusListener): () => void;
}
