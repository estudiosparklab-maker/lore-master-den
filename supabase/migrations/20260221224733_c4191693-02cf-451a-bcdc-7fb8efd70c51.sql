
-- Table for reusable enemy templates per game table
CREATE TABLE public.table_enemies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.game_tables(id) ON DELETE CASCADE,
  name text NOT NULL,
  hit_points integer NOT NULL DEFAULT 10,
  icon_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.table_enemies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can manage enemies" ON public.table_enemies
  FOR ALL USING (is_table_master(table_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members can view enemies" ON public.table_enemies
  FOR SELECT USING (is_table_member(table_id));
