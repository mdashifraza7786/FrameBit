import { NextRequest } from 'next/server';
import { subscribeToRealtimeEvents, RealtimePayload } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') || 'all';

  let unsubscribe: (() => void) | null = null;
  let intervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (payload: RealtimePayload) => {
        const text = `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(new TextEncoder().encode(text));
      };

      // Subscribe to real-time events on channel
      unsubscribe = subscribeToRealtimeEvents(channel, sendEvent);

      // Send initial connect handshake
      controller.enqueue(new TextEncoder().encode(`: connected to channel ${channel}\n\n`));

      // Keep-alive heartbeat every 15 seconds
      intervalId = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
        } catch {
          if (intervalId) clearInterval(intervalId);
        }
      }, 15000);
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (intervalId) clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
