import type { CapturedRequestDTO } from "@/contracts/schemas";

export type SseListener = (request: CapturedRequestDTO) => void;

const globalBrokerState = globalThis as unknown as {
  __tracelabSseListeners?: Map<string, Set<SseListener>>;
};

function getChannelMap(): Map<string, Set<SseListener>> {
  if (!globalBrokerState.__tracelabSseListeners) {
    globalBrokerState.__tracelabSseListeners = new Map();
  }
  return globalBrokerState.__tracelabSseListeners;
}

export function subscribeToBin(
  binId: string,
  listener: SseListener,
): () => void {
  const channels = getChannelMap();
  let listeners = channels.get(binId);
  if (!listeners) {
    listeners = new Set();
    channels.set(binId, listeners);
  }
  listeners.add(listener);

  return () => {
    const current = channels.get(binId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      channels.delete(binId);
    }
  };
}

export function publishCapturedRequest(
  binId: string,
  request: CapturedRequestDTO,
): void {
  const listeners = getChannelMap().get(binId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(request);
    } catch {
      // Isolate broken stream subscribers
    }
  }
}

export function getBinSubscriberCount(binId: string): number {
  return getChannelMap().get(binId)?.size ?? 0;
}
