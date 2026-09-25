create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  price_id text,
  status text not null default 'incomplete',
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "users can read own subscription" on public.subscriptions;
create policy "users can read own subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

-- Writes happen only from trusted Edge Functions using the service-role key.
revoke insert, update, delete on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;
