import crypto from 'crypto';
import { supabaseDb } from './supabase';
import { MemberRecord, RoomRecord } from './jsonDb';

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  if (!token) return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function generateCryptographicRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(8);
  let p1 = '';
  let p2 = '';
  for (let i = 0; i < 4; i++) {
    p1 += chars.charAt(bytes[i] % chars.length);
    p2 += chars.charAt(bytes[i + 4] % chars.length);
  }
  return `${p1}-${p2}`;
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const list: Record<string, string> = {};
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      list[name] = decodeURIComponent(val);
    }
  });
  return list;
}

export function extractTokenFromRequest(
  req: Request,
  roomIdOrCode?: string,
  bodyToken?: string
): string | null {
  // Check passed body token first if present
  if (bodyToken && bodyToken.trim() && bodyToken !== 'null' && bodyToken !== 'undefined') {
    return bodyToken.trim();
  }

  // Check URL query parameter (e.g. ?token=...)
  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token');
    if (queryToken && queryToken.trim() && queryToken !== 'null' && queryToken !== 'undefined') {
      return queryToken.trim();
    }
  } catch (e) {}

  // Check Authorization Bearer header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && token !== 'null' && token !== 'undefined') return token;
  }

  // Check custom header
  const customHeader = req.headers.get('x-drop-token');
  if (customHeader && customHeader.trim()) {
    return customHeader.trim();
  }

  // Check Cookie header (HttpOnly / SameSite session cookie)
  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (roomIdOrCode && cookies[`drop_token_${roomIdOrCode}`]) {
      return cookies[`drop_token_${roomIdOrCode}`];
    }
    for (const [key, val] of Object.entries(cookies)) {
      if (key.startsWith('drop_token_') && val) {
        return val;
      }
    }
  }

  return null;
}

export interface AuthResult {
  authenticated: boolean;
  member: MemberRecord | null;
  room: RoomRecord | null;
  isOwner: boolean;
  error?: string;
}

export async function verifyRoomMember(
  req: Request,
  roomIdOrCode: string,
  bodyToken?: string
): Promise<AuthResult> {
  const token = extractTokenFromRequest(req, roomIdOrCode, bodyToken);

  if (!token) {
    return {
      authenticated: false,
      member: null,
      room: null,
      isOwner: false,
      error: 'Authentication token is required.',
    };
  }

  // Retrieve room by code or ID
  let roomData = await supabaseDb.findRoomByCode(roomIdOrCode);
  let room: RoomRecord | null = roomData ? roomData.room : null;

  if (!room) {
    room = await supabaseDb.findRoomById(roomIdOrCode);
    if (!room) {
      return {
        authenticated: false,
        member: null,
        room: null,
        isOwner: false,
        error: 'Room not found.',
      };
    }
    roomData = await supabaseDb.findRoomByCode(room.code);
  }

  // Find member matching room and tokenHash strictly
  const members = roomData ? roomData.members : await supabaseDb.findMembersByRoomId(room.id);
  const tokenHash = hashToken(token);

  const member = members.find(
    (m) => Boolean(m.tokenHash) && m.tokenHash === tokenHash
  );

  if (!member) {
    return {
      authenticated: false,
      member: null,
      room,
      isOwner: false,
      error: 'Invalid or unauthorized authentication token.',
    };
  }

  const isOwner = member.role === 'OWNER';

  return {
    authenticated: true,
    member,
    room,
    isOwner,
  };
}
