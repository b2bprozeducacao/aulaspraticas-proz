DROP POLICY IF EXISTS "Aulas visíveis a todos" ON public.aulas;
REVOKE SELECT ON public.aulas FROM anon;
CREATE POLICY "Admin lê aulas" ON public.aulas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));