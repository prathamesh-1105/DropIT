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
  createRoom: async (name: string, code: string, createdBy: string, tokenHash?: string) => {
    // 1. Create locally in jsonDb instantly (< 1ms)
    const result = jsonDb.createRoom(name, code, createdBy, tokenHash);

    // 2. Parallel non-blocking sync to Supabase cloud
    if (isSupabaseConfigured()) {
      Promise.all([
        supabase.from('rooms').insert({
          id: result.room.id,
          code: result.room.code,
          name: result.room.name,
          created_at: result.room.createdAt,
          created_by: result.room.createdBy,
        }),
        supabase.from('members').insert({
          id: result.creatorMember.id,
          room_id: result.creatorMember.roomId,
          display_name: result.creatorMember.displayName,
          token_hash: result.creatorMember.tokenHash,
          role: result.creatorMember.role,
          joined_at: result.creatorMember.joinedAt,
        }),
      ]).catch((err) => {
        console.warn('Background Supabase createRoom sync error:', err);
      });
    }

    return result;
  },

  findRoomByCode: async (code: string) => {
    if (isSupabaseConfigured()) {
      try {
        const formattedCode = code.toUpperCase().trim();
        const cleanCode = formattedCode.replace(/-/g, '');

        const { data: roomData, error } = await supabase
          .from('rooms')
          .select('*')
          .or(`code.eq.${formattedCode},code.eq.${cleanCode}`)
          .limit(1);

        if (!error && roomData && roomData.length > 0) {
          const details = await supabaseDb.getRoomDetails(roomData[0]);
          if (details) return details;
        }
      } catch (err) {
        console.warn('Supabase findRoomByCode error, using jsonDb fallback:', err);
      }
    }
    return jsonDb.findRoomByCode(code);
  },

  getRoomDetails: async (roomData: any) => {
    const room: RoomRecord = {
      id: roomData.id,
      code: roomData.code,
      name: roomData.name,
      createdAt: roomData.created_at,
      createdBy: roomData.created_by,
    };

    let members: MemberRecord[] = [];
    let mediaItems: MediaRecord[] = [];

    try {
      const { data: membersData } = await supabase
        .from('members')
        .select('*')
        .eq('room_id', room.id);

      members = (membersData || []).map((m: any) => ({
        id: m.id,
        roomId: m.room_id,
        displayName: m.display_name,
        tokenHash: m.token_hash || '',
        role: m.role || 'MEMBER',
        joinedAt: m.joined_at,
      }));

      const { data: mediaData } = await supabase
        .from('media')
        .select('*')
        .eq('room_id', room.id);

      mediaItems = (mediaData || []).map((m: any) => ({
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
    } catch (err) {
      console.warn('Error reading room details from Supabase:', err);
    }

    // Merge jsonDb members & media items so no data is ever lost if Supabase has RLS or connection limits
    const jsonRes = jsonDb.findRoomById(room.id) ? jsonDb.findRoomByCode(room.code) : null;
    if (jsonRes) {
      const memberMap = new Map<string, MemberRecord>();
      members.forEach((m) => memberMap.set(m.id, m));
      jsonRes.members.forEach((m) => {
        if (!memberMap.has(m.id)) memberMap.set(m.id, m);
      });
      members = Array.from(memberMap.values());

      const mediaMap = new Map<string, MediaRecord>();
      mediaItems.forEach((m) => mediaMap.set(m.id, m));
      jsonRes.mediaItems.forEach((m) => {
        if (!mediaMap.has(m.id)) mediaMap.set(m.id, m);
      });
      mediaItems = Array.from(mediaMap.values());
    }

    return { room, members, mediaItems };
  },

  findMembersByRoomId: async (roomId: string): Promise<MemberRecord[]> => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('members').select('*').eq('room_id', roomId);
        if (!error && data && data.length > 0) {
          return data.map((m: any) => ({
            id: m.id,
            roomId: m.room_id,
            displayName: m.display_name,
            tokenHash: m.token_hash || '',
            role: m.role || 'MEMBER',
            joinedAt: m.joined_at,
          }));
        }
      } catch (err) {
        console.warn('Supabase findMembersByRoomId error:', err);
      }
    }
    return jsonDb.findMembersByRoomId(roomId);
  },

  findRoomById: async (id: string): Promise<RoomRecord | null> => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
          return {
            id: data.id,
            code: data.code,
            name: data.name,
            createdAt: data.created_at,
            createdBy: data.created_by,
          };
        }
      } catch (err) {
        console.warn('Supabase findRoomById error:', err);
      }
    }
    return jsonDb.findRoomById(id);
  },

  deleteRoom: async (roomId: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('rooms').delete().eq('id', roomId);
      } catch (e) {}
    }
    jsonDb.deleteRoom(roomId);
  },

  updateRoomName: async (roomId: string, newName: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('rooms').update({ name: newName }).eq('id', roomId);
      } catch (e) {}
    }
    jsonDb.updateRoomName(roomId, newName);
  },

  addMember: async (
    roomId: string,
    displayName: string,
    tokenHash?: string,
    role: 'OWNER' | 'MEMBER' = 'MEMBER'
  ): Promise<MemberRecord> => {
    if (isSupabaseConfigured()) {
      try {
        // Ensure room exists in Supabase rooms table first
        const roomInDb = await jsonDb.findRoomById(roomId);
        if (roomInDb) {
          try {
            await supabase.from('rooms').upsert({
              id: roomInDb.id,
              code: roomInDb.code,
              name: roomInDb.name,
              created_at: roomInDb.createdAt,
              created_by: roomInDb.createdBy,
            });
          } catch (e) {}
        }

        const { data: existing } = await supabase
          .from('members')
          .select('*')
          .eq('room_id', roomId)
          .ilike('display_name', displayName)
          .single();

        if (existing) {
          if (tokenHash || role) {
            await supabase
              .from('members')
              .update({
                ...(tokenHash ? { token_hash: tokenHash } : {}),
                ...(role ? { role } : {}),
              })
              .eq('id', existing.id);
          }
          const rec = {
            id: existing.id,
            roomId: existing.room_id,
            displayName: existing.display_name,
            tokenHash: tokenHash || existing.token_hash,
            role: role || existing.role,
            joinedAt: existing.joined_at,
          };
          jsonDb.addMember(roomId, displayName, tokenHash, role);
          return rec;
        }

        const newMember: MemberRecord = {
          id: Math.random().toString(36).substring(2, 11),
          roomId,
          displayName,
          tokenHash: tokenHash || '',
          role,
          joinedAt: new Date().toISOString(),
        };

        const { error } = await supabase.from('members').insert({
          id: newMember.id,
          room_id: newMember.roomId,
          display_name: newMember.displayName,
          token_hash: newMember.tokenHash,
          role: newMember.role,
          joined_at: newMember.joinedAt,
        });

        if (!error) {
          jsonDb.addMember(roomId, displayName, tokenHash, role);
          return newMember;
        } else {
          console.warn('Supabase addMember insert failed, using jsonDb:', error);
        }
      } catch (err) {
        console.warn('Supabase addMember error:', err);
      }
    }

    return jsonDb.addMember(roomId, displayName, tokenHash, role);
  },

  removeMember: async (memberId: string) => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('members').delete().eq('id', memberId);
      } catch (e) {}
    }
    jsonDb.removeMember(memberId);
  },

  addMedia: async (media: Omit<MediaRecord, 'createdAt'>): Promise<MediaRecord> => {
    const record: MediaRecord = {
      ...media,
      createdAt: new Date().toISOString(),
    };

    if (isSupabaseConfigured()) {
      try {
        // Ensure room and member exist in Supabase tables before inserting media
        const roomInDb = await jsonDb.findRoomById(media.roomId);
        if (roomInDb) {
          try {
            await supabase.from('rooms').upsert({
              id: roomInDb.id,
              code: roomInDb.code,
              name: roomInDb.name,
              created_at: roomInDb.createdAt,
              created_by: roomInDb.createdBy,
            });
          } catch (e) {}
        }

        const membersInDb = jsonDb.findMembersByRoomId(media.roomId);
        const memberInDb = membersInDb.find((m) => m.id === media.memberId);
        if (memberInDb) {
          try {
            await supabase.from('members').upsert({
              id: memberInDb.id,
              room_id: memberInDb.roomId,
              display_name: memberInDb.displayName,
              token_hash: memberInDb.tokenHash,
              role: memberInDb.role,
              joined_at: memberInDb.joinedAt,
            });
          } catch (e) {}
        }

        const { error } = await supabase.from('media').insert({
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

        if (error) {
          console.warn('Supabase addMedia insert error, syncing with jsonDb:', error);
        }
      } catch (err) {
        console.warn('Supabase addMedia error, syncing with jsonDb:', err);
      }
    }

    jsonDb.addMedia(record);
    return record;
  },

  findMediaById: async (id: string): Promise<MediaRecord | null> => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .eq('id', id)
          .single();

        if (!error && data) {
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
        }
      } catch (err) {
        console.warn('Supabase findMediaById error:', err);
      }
    }
    return jsonDb.findMediaById(id);
  },

  findMediaByRoom: async (roomId: string): Promise<MediaRecord[]> => {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .eq('room_id', roomId);

        if (!error && data && data.length > 0) {
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
        }
      } catch (err) {
        console.warn('Supabase findMediaByRoom error:', err);
      }
    }
    return jsonDb.findMediaByRoom(roomId);
  },

  deleteMedia: async (mediaId: string): Promise<MediaRecord | null> => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('media').delete().eq('id', mediaId);
      } catch (e) {}
    }
    return jsonDb.deleteMedia(mediaId);
  },

  deleteMultipleMedia: async (mediaIds: string[]): Promise<MediaRecord[]> => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('media').delete().in('id', mediaIds);
      } catch (e) {}
    }
    return jsonDb.deleteMultipleMedia(mediaIds);
  },
};
