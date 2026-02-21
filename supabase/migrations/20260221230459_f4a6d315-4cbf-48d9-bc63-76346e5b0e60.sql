
-- Fix SELECT policy to also allow creator to see their own table
DROP POLICY "Members can view tables" ON public.game_tables;

CREATE POLICY "Members can view tables"
ON public.game_tables
FOR SELECT
TO authenticated
USING (
  is_table_member(id) 
  OR has_role(auth.uid(), 'admin'::app_role) 
  OR created_by = auth.uid()
);
