
-- Add current_hp column to character_sheets (HP atual vs HP total)
ALTER TABLE public.character_sheets ADD COLUMN IF NOT EXISTS current_hp integer NOT NULL DEFAULT 10;

-- Create journal_entries table
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  character_ids uuid[] DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

-- Members can view journal entries
CREATE POLICY "Table members can view journal entries"
ON public.journal_entries FOR SELECT
USING (is_table_member(table_id));

-- Masters can manage journal entries
CREATE POLICY "Masters can manage journal entries"
ON public.journal_entries FOR ALL
USING (is_table_master(table_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for journal
ALTER PUBLICATION supabase_realtime ADD TABLE public.journal_entries;

-- Add RLS policy for players to insert/update their own tokens
CREATE POLICY "Players can insert own tokens"
ON public.map_tokens FOR INSERT
WITH CHECK (
  is_map_table_member(map_id) 
  AND token_type = 'player' 
  AND character_id IS NOT NULL
);

CREATE POLICY "Players can update own tokens"
ON public.map_tokens FOR UPDATE
USING (
  is_map_table_member(map_id)
  AND token_type = 'player'
  AND character_id IN (
    SELECT id FROM public.character_sheets WHERE user_id = auth.uid()
  )
);
