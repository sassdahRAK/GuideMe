/**
 * Lightweight in-memory Event Bus for engine event subscriptions.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} callback
   * @returns {() => void} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
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
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
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
  clear() {
    this.listeners.clear();
  }
}
