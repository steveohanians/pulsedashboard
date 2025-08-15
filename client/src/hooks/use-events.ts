import { useEffect, useCallback } from 'react';
import { eventBus, EventType, EventPayload } from '@/services/events/EventBus';

export function useEvent(
  event: EventType,
  handler: (payload: EventPayload) => void,
  deps: any[] = []
): void {
  const memoizedHandler = useCallback(handler, deps);

  useEffect(() => {
    const unsubscribe = eventBus.on(event, memoizedHandler);
    return unsubscribe;
  }, [event, memoizedHandler]);
}

export function useEventEmitter() {
  return useCallback((event: EventType, data: any, options?: any) => {
    eventBus.emit(event, data, options);
  }, []);
}