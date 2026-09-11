import { NextResponse } from 'next/server';
import { jsonDb } from '@/lib/jsonDb';
import { roomEvents, RoomEventPayload } from '@/lib/events';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const result = jsonDb.findRoomByCode(code);

  if (!result) {
    return new NextResponse('Room not found', { status: 404 });
  }

  const { room } = result;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: RoomEventPayload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error('Error enqueuing SSE event:', e);
        }
      };

      sendEvent({
        roomId: room.id,
        type: 'ROOM_UPDATED',
        timestamp: Date.now(),
      });

      const eventListener = (data: RoomEventPayload) => {
        sendEvent(data);
      };

      roomEvents.on(`room:${room.id}`, eventListener);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 25000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        roomEvents.off(`room:${room.id}`, eventListener);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
