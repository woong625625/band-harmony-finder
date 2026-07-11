
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_token text NOT NULL UNIQUE,
  member_token text NOT NULL UNIQUE,
  title text NOT NULL,
  deadline timestamptz NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  start_hour int NOT NULL DEFAULT 9,
  end_hour int NOT NULL DEFAULT 22,
  min_available int,
  fixed_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  recurrence text NOT NULL DEFAULT 'none',
  recurrence_until date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.members (session_id);
CREATE INDEX ON public.events (member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon, authenticated;
GRANT ALL ON public.sessions TO service_role;
GRANT ALL ON public.members TO service_role;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Token-gated access model: access is protected by unguessable tokens shared via links.
-- All operations are allowed at DB level; the app filters by token in queries.
CREATE POLICY "public sessions access" ON public.sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public members access" ON public.members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "public events access" ON public.events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
