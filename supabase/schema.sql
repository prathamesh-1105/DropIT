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
  token_hash TEXT,
  role TEXT DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_room_id ON members(room_id);
CREATE INDEX IF NOT EXISTS idx_members_token_hash ON members(token_hash);

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

-- 5. Row Level Security Policies (Defense in depth)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_chunks ENABLE ROW LEVEL SECURITY;

-- Allow full access strictly for the internal API service role
CREATE POLICY "Allow service role full access on rooms" ON rooms TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on members" ON members TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on media" ON media TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role full access on upload_chunks" ON upload_chunks TO service_role USING (true) WITH CHECK (true);

-- 6. Private Storage Bucket setup (dropit-media)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dropit-media', 'dropit-media', false)
ON CONFLICT (id) DO UPDATE SET public = false;


