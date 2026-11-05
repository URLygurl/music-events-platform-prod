BEGIN;

-- Serialize this additive migration when multiple app instances start together.
SELECT pg_advisory_xact_lock(20261106, 1);

-- Auth IDs remain opaque: legacy UUIDs and better-auth:<id> are independent.
-- There is deliberately no FK to public.users and no email-based linking.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id varchar PRIMARY KEY,
  username varchar(40),
  user_type varchar(20) NOT NULL DEFAULT 'audience',
  avatar_data text,
  avatar_mime varchar(10),
  avatar_updated_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_username_valid CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_.-]{3,40}$'),
  CONSTRAINT user_profiles_user_type_valid CHECK (user_type IN ('guest', 'audience', 'artist', 'advertiser', 'supplier', 'venue')),
  CONSTRAINT user_profiles_avatar_mime_valid CHECK (avatar_mime IS NULL OR avatar_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT user_profiles_avatar_complete CHECK (
    (avatar_data IS NULL AND avatar_mime IS NULL AND avatar_updated_at IS NULL)
    OR (avatar_data IS NOT NULL AND avatar_mime IS NOT NULL AND avatar_updated_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_unique
  ON public.user_profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_favourites (
  user_id varchar NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  CONSTRAINT user_favourites_pkey PRIMARY KEY (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS user_favourites_product_id_idx ON public.user_favourites (product_id);

-- Tickets are issued by trusted server-side fulfilment only, not profile clients.
CREATE TABLE IF NOT EXISTS public.user_tickets (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  event_id integer REFERENCES public.events(id) ON DELETE SET NULL,
  label varchar(255) NOT NULL,
  ticket_reference varchar(255),
  status varchar(32) NOT NULL DEFAULT 'issued',
  issued_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_tickets_user_id_idx ON public.user_tickets (user_id);
CREATE INDEX IF NOT EXISTS user_tickets_event_id_idx ON public.user_tickets (event_id);

-- Existing/unowned orders stay untouched; only checkout may set new ownership.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS owner_user_id varchar;
CREATE INDEX IF NOT EXISTS orders_owner_user_id_idx
  ON public.orders (owner_user_id) WHERE owner_user_id IS NOT NULL;

COMMIT;
