
-- Drop the restrictive policy
DROP POLICY "Masters and admins can create tables" ON public.game_tables;

-- Recreate as permissive
CREATE POLICY "Masters and admins can create tables"
ON public.game_tables
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'master'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);
