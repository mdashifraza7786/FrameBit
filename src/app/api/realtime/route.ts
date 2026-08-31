import { NextRequest } from 'next/server';
import { subscribeToRealtimeEvents, RealtimePayload } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get('channel') || 'all';

  let unsubscribe: (() => void) | null = null;
  let intervalId: NodeJS.Timeout | null = null;
  let maxDurationTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        if (maxDurationTimer) {
          clearTimeout(maxDurationTimer);
          maxDurationTimer = null;
        }
      };

      const sendEvent = (payload: RealtimePayload) => {
        if (isClosed) return;
        try {
          const text = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(new TextEncoder().encode(text));
        } catch {
          cleanup();
        }
      };

      // Subscribe to real-time events on channel
      unsubscribe = subscribeToRealtimeEvents(channel, sendEvent);

      // Send initial connect handshake
      controller.enqueue(new TextEncoder().encode(`: connected to channel ${channel}\n\n`));

      // Keep-alive heartbeat every 15 seconds
      intervalId = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);

      // Gracefully close stream after 55s before Vercel's serverless timeout threshold.
      // Browser EventSource automatically reconnects immediately with zero interruption.
      maxDurationTimer = setTimeout(() => {
        cleanup();
        try {
          controller.close();
        } catch {}
      }, 55000);

      // Handle client disconnect / tab close immediately
      req.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      if (unsubscribe) unsubscribe();
      if (intervalId) clearInterval(intervalId);
      if (maxDurationTimer) clearTimeout(maxDurationTimer);
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
