import { EventEmitter } from 'events';

class RoomEventManager extends EventEmitter {}

const globalForEvents = globalThis as unknown as {
  roomEvents: RoomEventManager | undefined;
};

export const roomEvents = globalForEvents.roomEvents ?? new RoomEventManager();
roomEvents.setMaxListeners(500);

if (process.env.NODE_ENV !== 'production') globalForEvents.roomEvents = roomEvents;

export interface RoomEventPayload {
  roomId: string;
  type: 'MEMBER_JOINED' | 'UPLOAD_START' | 'UPLOAD_PROGRESS' | 'MEDIA_ADDED' | 'MEDIA_DELETED' | 'ROOM_UPDATED' | 'ROOM_DELETED' | 'MEMBER_REMOVED';
  memberId?: string;
  memberName?: string;
  count?: number;
  filename?: string;
  progress?: number;
  timestamp: number;
}

export function broadcastRoomEvent(payload: RoomEventPayload) {
  roomEvents.emit(`room:${payload.roomId}`, payload);
}
