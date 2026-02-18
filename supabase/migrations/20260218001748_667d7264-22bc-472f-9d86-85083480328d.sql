
-- Add new columns to character_sheets
ALTER TABLE public.character_sheets 
ADD COLUMN IF NOT EXISTS alignment_law text,
ADD COLUMN IF NOT EXISTS alignment_moral text,
ADD COLUMN IF NOT EXISTS icon_url text,
ADD COLUMN IF NOT EXISTS weight text;

-- Dice rolls table
CREATE TABLE public.dice_rolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  character_name text,
  num_dice integer NOT NULL DEFAULT 1,
  num_faces integer NOT NULL DEFAULT 20,
  results integer[] NOT NULL DEFAULT '{}',
  total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dice_rolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table members can view dice rolls"
ON public.dice_rolls FOR SELECT
TO authenticated
USING (is_table_member(table_id));

CREATE POLICY "Table members can roll dice"
ON public.dice_rolls FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_table_member(table_id));

-- Chat messages table
CREATE TABLE public.table_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.table_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table members can view messages"
ON public.table_messages FOR SELECT
TO authenticated
USING (is_table_member(table_id));

CREATE POLICY "Table members can send messages"
ON public.table_messages FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND is_table_member(table_id));

-- Maps table
CREATE TABLE public.table_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.table_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Table members can view maps"
ON public.table_maps FOR SELECT
TO authenticated
USING (is_table_member(table_id));

CREATE POLICY "Masters can manage maps"
ON public.table_maps FOR ALL
TO authenticated
USING (is_table_master(table_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Map tokens (players + enemies)
CREATE TABLE public.map_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.table_maps(id) ON DELETE CASCADE,
  token_type text NOT NULL DEFAULT 'player',
  character_id uuid REFERENCES public.character_sheets(id) ON DELETE CASCADE,
  name text,
  icon_url text,
  hit_points integer DEFAULT 0,
  max_hit_points integer DEFAULT 0,
  x_position double precision NOT NULL DEFAULT 50,
  y_position double precision NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.map_tokens ENABLE ROW LEVEL SECURITY;

-- Need a function to check map membership
CREATE OR REPLACE FUNCTION public.is_map_table_member(_map_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_maps m
    JOIN public.table_memberships tm ON tm.table_id = m.table_id
    WHERE m.id = _map_id AND tm.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_map_table_master(_map_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.table_maps m
    JOIN public.table_memberships tm ON tm.table_id = m.table_id
    WHERE m.id = _map_id AND tm.user_id = auth.uid() AND tm.role = 'master'
  )
$$;

CREATE POLICY "Table members can view tokens"
ON public.map_tokens FOR SELECT
TO authenticated
USING (is_map_table_member(map_id));

CREATE POLICY "Masters can manage tokens"
ON public.map_tokens FOR ALL
TO authenticated
USING (is_map_table_master(map_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('maps', 'maps', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for maps
CREATE POLICY "Anyone can view maps" ON storage.objects FOR SELECT USING (bucket_id = 'maps');
CREATE POLICY "Authenticated users can upload maps" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'maps');
CREATE POLICY "Authenticated users can update maps" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'maps');

-- Storage policies for avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated users can update avatars" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars');

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dice_rolls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_maps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_tokens;
