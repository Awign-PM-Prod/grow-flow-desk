-- Team admins can delete accounts (same scope as their update access).
CREATE POLICY "Team admins can delete accounts"
  ON public.accounts FOR DELETE
  USING (public.is_team_admin(auth.uid()));
