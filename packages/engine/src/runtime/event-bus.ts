export type EventHandler<T = any> = (payload: T) => void;

/**
 * Lightweight in-memory Event Bus for engine event subscriptions.
 */
export class EventBus {
  private listeners: Map<string, Set<EventHandler>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event.
   */
  on<T = any>(event: string, callback: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   */
  off<T = any>(event: string, callback: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(callback);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<T = any>(event: string, payload?: T): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[GuideMe EventBus] Error in handler for event '${event}':`, err);
        }
      }
    }
  }

  /**
   * Clear all listeners.
   */
  clear(): void {
    this.listeners.clear();
  }
}
