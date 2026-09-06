import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface RoomRecord {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  createdBy?: string;
}

export interface MemberRecord {
  id: string;
  roomId: string;
  displayName: string;
  joinedAt: string;
}

export interface MediaRecord {
  id: string;
  roomId: string;
  memberId: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  previewPath?: string;
  checksum: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: string;
}

interface DbSchema {
  rooms: RoomRecord[];
  members: MemberRecord[];
  media: MediaRecord[];
}

function readDb(): DbSchema {
  if (!fs.existsSync(DB_FILE)) {
    const initial: DbSchema = { rooms: [], members: [], media: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading jsonDb:', err);
    return { rooms: [], members: [], media: [] };
  }
}

function writeDb(data: DbSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export const jsonDb = {
  // Room queries
  createRoom: (name: string, code: string, createdBy: string) => {
    const db = readDb();
    const roomId = Math.random().toString(36).substring(2, 11);
    const memberId = Math.random().toString(36).substring(2, 11);

    const room: RoomRecord = {
      id: roomId,
      code,
      name,
      createdAt: new Date().toISOString(),
      createdBy,
    };

    const creatorMember: MemberRecord = {
      id: memberId,
      roomId,
      displayName: createdBy,
      joinedAt: new Date().toISOString(),
    };

    db.rooms.push(room);
    db.members.push(creatorMember);
    writeDb(db);

    return { room, creatorMember };
  },

  findRoomByCode: (code: string) => {
    const db = readDb();
    const formattedCode = code.toUpperCase().trim();
    const room = db.rooms.find(
      (r) =>
        r.code === formattedCode ||
        r.code.replace('-', '') === formattedCode.replace('-', '')
    );
    if (!room) return null;

    const members = db.members.filter((m) => m.roomId === room.id);
    const mediaItems = db.media.filter((m) => m.roomId === room.id);

    return { room, members, mediaItems };
  },

  findRoomById: (id: string) => {
    const db = readDb();
    return db.rooms.find((r) => r.id === id) || null;
  },

  deleteRoom: (roomId: string) => {
    const db = readDb();
    db.rooms = db.rooms.filter((r) => r.id !== roomId);
    db.members = db.members.filter((m) => m.roomId !== roomId);
    db.media = db.media.filter((m) => m.roomId !== roomId);
    writeDb(db);
  },

  updateRoomName: (roomId: string, newName: string) => {
    const db = readDb();
    const room = db.rooms.find((r) => r.id === roomId);
    if (room) {
      room.name = newName;
      writeDb(db);
    }
  },

  // Member queries
  addMember: (roomId: string, displayName: string) => {
    const db = readDb();
    let existing = db.members.find(
      (m) => m.roomId === roomId && m.displayName.toLowerCase() === displayName.toLowerCase()
    );
    if (existing) return existing;

    const newMember: MemberRecord = {
      id: Math.random().toString(36).substring(2, 11),
      roomId,
      displayName,
      joinedAt: new Date().toISOString(),
    };
    db.members.push(newMember);
    writeDb(db);
    return newMember;
  },

  removeMember: (memberId: string) => {
    const db = readDb();
    db.members = db.members.filter((m) => m.id !== memberId);
    db.media = db.media.filter((m) => m.memberId !== memberId);
    writeDb(db);
  },

  // Media queries
  addMedia: (media: Omit<MediaRecord, 'createdAt'>) => {
    const db = readDb();
    const record: MediaRecord = {
      ...media,
      createdAt: new Date().toISOString(),
    };
    db.media.push(record);
    writeDb(db);
    return record;
  },

  findMediaById: (id: string) => {
    const db = readDb();
    return db.media.find((m) => m.id === id) || null;
  },

  findMediaByRoom: (roomId: string) => {
    const db = readDb();
    return db.media.filter((m) => m.roomId === roomId);
  },

  deleteMedia: (mediaId: string) => {
    const db = readDb();
    const media = db.media.find((m) => m.id === mediaId);
    if (!media) return null;
    db.media = db.media.filter((m) => m.id !== mediaId);
    writeDb(db);
    return media;
  },

  deleteMultipleMedia: (mediaIds: string[]) => {
    const db = readDb();
    const idsSet = new Set(mediaIds);
    const deletedItems = db.media.filter((m) => idsSet.has(m.id));
    db.media = db.media.filter((m) => !idsSet.has(m.id));
    writeDb(db);
    return deletedItems;
  },
};
