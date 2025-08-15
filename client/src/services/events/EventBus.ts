export type EventType = 
  | 'ga4.sync.started'
  | 'ga4.sync.completed'
  | 'ga4.sync.failed'
  | 'ga4.sync.progress'
  | 'semrush.integration.started'
  | 'semrush.integration.completed'
  | 'semrush.integration.failed'
  | 'portfolio.company.added'
  | 'portfolio.company.deleted'
  | 'portfolio.averages.recalculating'
  | 'portfolio.averages.recalculated'
  | 'benchmark.company.added'
  | 'client.created'
  | 'client.ga4.connected';

export interface EventPayload<T = any> {
  type: EventType;
  data: T;
  timestamp: number;
  clientId?: string;
  correlationId?: string;
  progress?: number;
  message?: string;
}

type EventHandler<T = any> = (payload: EventPayload<T>) => void;

import { APP_CONFIG } from '@/config/app.config';

class EventBus {
  private static instance: EventBus;
  private handlers = new Map<EventType, Set<EventHandler>>();
  private eventHistory: EventPayload[] = [];
  private maxHistorySize = APP_CONFIG.defaults.maxHistorySize;

  private constructor() {
    // Set up WebSocket or SSE connection for server events
    this.setupServerConnection();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  // Subscribe to events
  on(event: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  // Subscribe to event once
  once(event: EventType, handler: EventHandler): void {
    const wrappedHandler = (payload: EventPayload) => {
      handler(payload);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }

  // Unsubscribe from events
  off(event: EventType, handler?: EventHandler): void {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      this.handlers.get(event)?.delete(handler);
    }
  }

  // Emit events
  emit(event: EventType, data: any, options?: Partial<EventPayload>): void {
    const payload: EventPayload = {
      type: event,
      data,
      timestamp: Date.now(),
      ...options
    };

    // Add to history
    this.addToHistory(payload);

    // Call handlers
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }

    // Log for debugging
    console.debug('Event emitted:', event, payload);
  }

  // Wait for event with timeout
  async waitFor(event: EventType, timeout = 60000): Promise<EventPayload> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.off(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const handler = (payload: EventPayload) => {
        clearTimeout(timer);
        resolve(payload);
      };

      this.once(event, handler);
    });
  }

  // Get event history
  getHistory(event?: EventType): EventPayload[] {
    if (event) {
      return this.eventHistory.filter(e => e.type === event);
    }
    return [...this.eventHistory];
  }

  private addToHistory(payload: EventPayload): void {
    this.eventHistory.push(payload);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  // Set up server-sent events or WebSocket
  private setupServerConnection(): void {
    // For now, use polling as fallback
    // TODO: Implement WebSocket or SSE
    this.pollForServerEvents();
  }

  private async pollForServerEvents(): Promise<void> {
    // Poll for server events using config value
    setInterval(async () => {
      try {
        const response = await fetch('/api/events/poll', {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const events = await response.json();
          events.forEach((serverEvent: any) => {
            this.emit(serverEvent.type, serverEvent.data, {
              clientId: serverEvent.clientId,
              correlationId: serverEvent.correlationId
            });
          });
        }
      } catch (error) {
        // Silent fail for polling
      }
    }, APP_CONFIG.polling.eventPoll);
  }
}

export const eventBus = EventBus.getInstance();