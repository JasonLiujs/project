import { LiveEditEvent } from '../../../types/liveEdit';

interface LiveEditSubscriptionOptions {
  onEvent: (event: LiveEditEvent) => void;
  onError?: (error: Error) => void;
}

export function subscribeToLiveEditEvents(
  baseUrl: string,
  options: LiveEditSubscriptionOptions,
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return startPolling(baseUrl, options);
  }

  const eventSource = new EventSource(`${baseUrl}/api/live-edit/stream`);

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as LiveEditEvent;
      options.onEvent(payload);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('解析实时编辑事件失败'));
    }
  };

  eventSource.onerror = () => {
    eventSource.close();
    startPolling(baseUrl, options);
  };

  return () => {
    eventSource.close();
  };
}

function startPolling(baseUrl: string, options: LiveEditSubscriptionOptions): () => void {
  let stopped = false;
  let lastTimestamp = 0;

  const tick = async () => {
    if (stopped) {
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/live-edit`);
      if (response.ok) {
        const data = await response.json();
        const edit = data?.edit as LiveEditEvent | null;
        if (edit && edit.timestamp > lastTimestamp) {
          lastTimestamp = edit.timestamp;
          options.onEvent(edit);
        }
      }
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error('轮询实时编辑事件失败'));
    } finally {
      if (!stopped) {
        window.setTimeout(tick, 2000);
      }
    }
  };

  void tick();

  return () => {
    stopped = true;
  };
}
