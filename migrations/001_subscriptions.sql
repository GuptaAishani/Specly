-- Apply once to your Supabase project using the SQL editor or migration tooling.
-- No anonymous/browser role can read or write billing or session records.
create table public.specly_accounts (
  user_id uuid primary key references auth.users(id),
  phone_hash text not null unique,
  stripe_customer_id text unique,
  trial_used boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.specly_sessions (
  id_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  sealed_tokens text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on public.specly_sessions(expires_at);
create table public.specly_checkout_attempts (
  user_id uuid primary key references public.specly_accounts(user_id),
  id uuid not null default gen_random_uuid(),
  trial boolean not null,
  session_id text,
  created_at timestamptz not null default now()
);
create table public.specly_billing_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
create table public.specly_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.specly_accounts(user_id),
  terms_version text not null,
  offer text not null,
  created_at timestamptz not null default now()
);
create table public.specly_rate_limits (
  bucket text primary key,
  count integer not null,
  expires_at timestamptz not null
);
alter table public.specly_accounts enable row level security;
alter table public.specly_sessions enable row level security;
alter table public.specly_checkout_attempts enable row level security;
alter table public.specly_billing_events enable row level security;
alter table public.specly_consents enable row level security;
alter table public.specly_rate_limits enable row level security;
revoke all on public.specly_accounts,public.specly_sessions,public.specly_checkout_attempts,public.specly_billing_events,public.specly_consents,public.specly_rate_limits from anon,authenticated;
grant all on public.specly_accounts,public.specly_sessions,public.specly_checkout_attempts,public.specly_billing_events,public.specly_consents,public.specly_rate_limits to service_role;

create function public.specly_claim_account(p_user uuid,p_phone text)
returns public.specly_accounts language plpgsql security definer set search_path=public as $$
declare a public.specly_accounts;
begin
  insert into public.specly_accounts(user_id,phone_hash) values(p_user,p_phone)
    on conflict(user_id) do nothing;
  select * into a from public.specly_accounts where user_id=p_user;
  if a.phone_hash<>p_phone then raise exception 'Phone change requires account recovery'; end if;
  return a;
end $$;
create function public.specly_attempt(p_user uuid,p_old uuid default null)
returns public.specly_checkout_attempts language plpgsql security definer set search_path=public as $$
declare a public.specly_checkout_attempts;
begin
  perform 1 from public.specly_accounts where user_id=p_user for update;
  if p_old is not null then delete from public.specly_checkout_attempts where user_id=p_user and id=p_old; end if;
  insert into public.specly_checkout_attempts(user_id,trial)
    select user_id,not trial_used from public.specly_accounts where user_id=p_user on conflict(user_id) do nothing;
  select * into a from public.specly_checkout_attempts where user_id=p_user;
  return a;
end $$;
create function public.specly_rate(p_bucket text,p_max integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  insert into public.specly_rate_limits(bucket,count,expires_at) values(p_bucket,1,now()+make_interval(secs=>p_seconds))
  on conflict(bucket) do update set count=case when specly_rate_limits.expires_at<=now() then 1 else specly_rate_limits.count+1 end,
    expires_at=case when specly_rate_limits.expires_at<=now() then now()+make_interval(secs=>p_seconds) else specly_rate_limits.expires_at end
  returning count into n;
  return n<=p_max;
end $$;
revoke all on function public.specly_claim_account(uuid,text),public.specly_attempt(uuid,uuid),public.specly_rate(text,integer,integer) from public,anon,authenticated;
grant execute on function public.specly_claim_account(uuid,text),public.specly_attempt(uuid,uuid),public.specly_rate(text,integer,integer) to service_role;
-- Operational retention: schedule daily deletion of expired sessions/rate-limit buckets;
-- retain billing records and phone claims according to the published retention policy.
