import { createClient } from '@supabase/supabase-js';
import { jsonDb, RoomRecord, MemberRecord, MediaRecord } from './jsonDb';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qikbkbhskjhxqpazbwpr.supabase.co';
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Check if valid Supabase key is configured
const isSupabaseConfigured = () => {
  return (
    supabaseKey &&
    supabaseKey !== 'your_supabase_anon_key_here' &&
    supabaseKey !== 'your_supabase_service_role_key_here'
  );
};

export const supabaseDb = {
  createRoom: async (name: string, code: string, createdBy: string) => {
    if (!isSupabaseConfigured()) {
      return jsonDb.createRoom(name, code, createdBy);
    }

    const roomId = Math.random().toString(36).substring(2, 11);
    const memberId = Math.random().toString(36).substring(2, 11);

    const room: RoomRecord = {
      id: roomId,
      code: code.toUpperCase().trim(),
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

    const { error: roomErr } = await supabase.from('rooms').insert({
      id: room.id,
      code: room.code,
      name: room.name,
      created_at: room.createdAt,
      created_by: room.createdBy,
    });

    if (roomErr) {
      console.error('Supabase createRoom error:', roomErr);
      return jsonDb.createRoom(name, code, createdBy);
    }

    const { error: memberErr } = await supabase.from('members').insert({
      id: creatorMember.id,
      room_id: creatorMember.roomId,
      display_name: creatorMember.displayName,
      joined_at: creatorMember.joinedAt,
    });

    if (memberErr) {
      console.error('Supabase createMember error:', memberErr);
    }

    return { room, creatorMember };
  },

  findRoomByCode: async (code: string) => {
    if (!isSupabaseConfigured()) {
      return jsonDb.findRoomByCode(code);
    }

    const formattedCode = code.toUpperCase().trim();
    const cleanCode = formattedCode.replace(/-/g, '');

    const { data: roomData, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .or(`code.eq.${formattedCode},code.eq.${cleanCode}`)
      .single();

    if (roomErr || !roomData) {
      // Fallback query matching formatted / unformatted
      const { data: allRooms } = await supabase.from('rooms').select('*');
      const room = allRooms?.find(
        (r) =>
          r.code === formattedCode ||
          r.code.replace(/-/g, '') === cleanCode
      );
      if (!room) return null;
      return await supabaseDb.getRoomDetails(room);
    }

    return await supabaseDb.getRoomDetails(roomData);
  },

  getRoomDetails: async (roomData: any) => {
    const room: RoomRecord = {
      id: roomData.id,
      code: roomData.code,
      name: roomData.name,
      createdAt: roomData.created_at,
      createdBy: roomData.created_by,
    };

    const { data: membersData } = await supabase
      .from('members')
      .select('*')
      .eq('room_id', room.id);

    const { data: mediaData } = await supabase
      .from('media')
      .select('*')
      .eq('room_id', room.id);

    const members: MemberRecord[] = (membersData || []).map((m: any) => ({
      id: m.id,
      roomId: m.room_id,
      displayName: m.display_name,
      joinedAt: m.joined_at,
    }));

    const mediaItems: MediaRecord[] = (mediaData || []).map((m: any) => ({
      id: m.id,
      roomId: m.room_id,
      memberId: m.member_id,
      originalFilename: m.original_filename,
      mimeType: m.mime_type,
      size: Number(m.size),
      storagePath: m.storage_path,
      previewPath: m.preview_path,
      checksum: m.checksum || '',
      width: m.width || undefined,
      height: m.height || undefined,
      duration: m.duration || undefined,
      createdAt: m.created_at,
    }));

    return { room, members, mediaItems };
  },

  findRoomById: async (id: string): Promise<RoomRecord | null> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.findRoomById(id);
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      createdAt: data.created_at,
      createdBy: data.created_by,
    };
  },

  deleteRoom: async (roomId: string) => {
    if (!isSupabaseConfigured()) {
      return jsonDb.deleteRoom(roomId);
    }

    await supabase.from('rooms').delete().eq('id', roomId);
  },

  updateRoomName: async (roomId: string, newName: string) => {
    if (!isSupabaseConfigured()) {
      return jsonDb.updateRoomName(roomId, newName);
    }

    await supabase.from('rooms').update({ name: newName }).eq('id', roomId);
  },

  addMember: async (roomId: string, displayName: string): Promise<MemberRecord> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.addMember(roomId, displayName);
    }

    // Check if member with name exists
    const { data: existing } = await supabase
      .from('members')
      .select('*')
      .eq('room_id', roomId)
      .ilike('display_name', displayName)
      .single();

    if (existing) {
      return {
        id: existing.id,
        roomId: existing.room_id,
        displayName: existing.display_name,
        joinedAt: existing.joined_at,
      };
    }

    const newMember: MemberRecord = {
      id: Math.random().toString(36).substring(2, 11),
      roomId,
      displayName,
      joinedAt: new Date().toISOString(),
    };

    await supabase.from('members').insert({
      id: newMember.id,
      room_id: newMember.roomId,
      display_name: newMember.displayName,
      joined_at: newMember.joinedAt,
    });

    return newMember;
  },

  removeMember: async (memberId: string) => {
    if (!isSupabaseConfigured()) {
      return jsonDb.removeMember(memberId);
    }

    await supabase.from('members').delete().eq('id', memberId);
  },

  addMedia: async (media: Omit<MediaRecord, 'createdAt'>): Promise<MediaRecord> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.addMedia(media);
    }

    const record: MediaRecord = {
      ...media,
      createdAt: new Date().toISOString(),
    };

    await supabase.from('media').insert({
      id: record.id,
      room_id: record.roomId,
      member_id: record.memberId,
      original_filename: record.originalFilename,
      mime_type: record.mimeType,
      size: record.size,
      storage_path: record.storagePath,
      preview_path: record.previewPath,
      checksum: record.checksum,
      width: record.width,
      height: record.height,
      duration: record.duration,
      created_at: record.createdAt,
    });

    return record;
  },

  findMediaById: async (id: string): Promise<MediaRecord | null> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.findMediaById(id);
    }

    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      roomId: data.room_id,
      memberId: data.member_id,
      originalFilename: data.original_filename,
      mimeType: data.mime_type,
      size: Number(data.size),
      storagePath: data.storage_path,
      previewPath: data.preview_path,
      checksum: data.checksum || '',
      width: data.width || undefined,
      height: data.height || undefined,
      duration: data.duration || undefined,
      createdAt: data.created_at,
    };
  },

  findMediaByRoom: async (roomId: string): Promise<MediaRecord[]> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.findMediaByRoom(roomId);
    }

    const { data, error } = await supabase
      .from('media')
      .select('*')
      .eq('room_id', roomId);

    if (error || !data) return [];

    return data.map((m: any) => ({
      id: m.id,
      roomId: m.room_id,
      memberId: m.member_id,
      originalFilename: m.original_filename,
      mimeType: m.mime_type,
      size: Number(m.size),
      storagePath: m.storage_path,
      previewPath: m.preview_path,
      checksum: m.checksum || '',
      width: m.width || undefined,
      height: m.height || undefined,
      duration: m.duration || undefined,
      createdAt: m.created_at,
    }));
  },

  deleteMedia: async (mediaId: string): Promise<MediaRecord | null> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.deleteMedia(mediaId);
    }

    const media = await supabaseDb.findMediaById(mediaId);
    if (!media) return null;

    await supabase.from('media').delete().eq('id', mediaId);
    return media;
  },

  deleteMultipleMedia: async (mediaIds: string[]): Promise<MediaRecord[]> => {
    if (!isSupabaseConfigured()) {
      return jsonDb.deleteMultipleMedia(mediaIds);
    }

    const { data: mediaItems } = await supabase
      .from('media')
      .select('*')
      .in('id', mediaIds);

    await supabase.from('media').delete().in('id', mediaIds);

    return (mediaItems || []).map((m: any) => ({
      id: m.id,
      roomId: m.room_id,
      memberId: m.member_id,
      originalFilename: m.original_filename,
      mimeType: m.mime_type,
      size: Number(m.size),
      storagePath: m.storage_path,
      previewPath: m.preview_path,
      checksum: m.checksum || '',
      width: m.width || undefined,
      height: m.height || undefined,
      duration: m.duration || undefined,
      createdAt: m.created_at,
    }));
  },
};
