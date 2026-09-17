-- DropIT Supabase Database Schema
-- Run this script in your Supabase Dashboard: SQL Editor -> New Query -> Run

-- 1. Rooms Table
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);

-- 2. Members Table
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_room_id ON members(room_id);

-- 3. Media Table
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  preview_path TEXT,
  checksum TEXT DEFAULT '',
  width INT,
  height INT,
  duration FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_room_id ON media(room_id);
CREATE INDEX IF NOT EXISTS idx_media_member_id ON media(member_id);

-- 4. Upload Chunks Table (for chunked uploading)
CREATE TABLE IF NOT EXISTS upload_chunks (
  id TEXT PRIMARY KEY,
  upload_id TEXT NOT NULL,
  chunk_index INT NOT NULL,
  total_chunks INT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_upload_chunk UNIQUE (upload_id, chunk_index)
);

-- 5. Storage Bucket setup (dropit-media)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dropit-media', 'dropit-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to dropit-media bucket
CREATE POLICY "Public Read Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'dropit-media');

CREATE POLICY "Public Insert Access" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dropit-media');

CREATE POLICY "Public Delete Access" ON storage.objects
  FOR DELETE USING (bucket_id = 'dropit-media');
