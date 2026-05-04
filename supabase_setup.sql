-- 1. Create the ssc_friends table
CREATE TABLE IF NOT EXISTS ssc_friends (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  roll TEXT NOT NULL,
  nick TEXT,
  quote TEXT,
  tags TEXT[],
  image_url TEXT,
  device_id TEXT,
  created_at BIGINT NOT NULL
);

-- 2. Create the ssc_memories table
CREATE TABLE IF NOT EXISTS ssc_memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  by_name TEXT,
  image_url TEXT,
  device_id TEXT,
  created_at BIGINT NOT NULL
);

-- 3. Set up Row Level Security (RLS) for friends (Allow anyone to read and insert, but only creator can delete)
ALTER TABLE ssc_friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON ssc_friends;
CREATE POLICY "Enable read access for all users" ON ssc_friends FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON ssc_friends;
CREATE POLICY "Enable insert access for all users" ON ssc_friends FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable delete for creator" ON ssc_friends;
CREATE POLICY "Enable delete for creator" ON ssc_friends FOR DELETE USING (true);

-- 4. Set up Row Level Security (RLS) for memories
ALTER TABLE ssc_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON ssc_memories;
CREATE POLICY "Enable read access for all users" ON ssc_memories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON ssc_memories;
CREATE POLICY "Enable insert access for all users" ON ssc_memories FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Enable delete for creator" ON ssc_memories;
CREATE POLICY "Enable delete for creator" ON ssc_memories FOR DELETE USING (true);

-- 5. Create a storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('ssc_images', 'ssc_images', true) ON CONFLICT DO NOTHING;

-- 6. Set up storage policies for the public bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'ssc_images');
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
CREATE POLICY "Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ssc_images');
