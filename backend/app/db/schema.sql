create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  external_subject text unique,
  name text,
  email text unique,
  created_at timestamptz not null default now()
);

alter table users add column if not exists external_subject text;
alter table users add column if not exists request_count integer not null default 0;
alter table users add column if not exists plan text not null default 'free';

create table if not exists search_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete set null,
  original_request text not null,
  parsed_intent_json jsonb not null default '{}'::jsonb,
  location_lat numeric(10, 7),
  location_lng numeric(10, 7),
  location_label text,
  radius integer not null default 3000,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists businesses (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references search_tasks(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  website text,
  rating numeric(2, 1),
  review_count integer,
  distance integer,
  opening_hours_json jsonb,
  price_level integer,
  place_id text,
  google_maps_url text,
  business_status text,
  open_now boolean,
  relevance_score numeric(8, 4),
  selected_for_call boolean not null default true,
  do_not_call boolean not null default false,
  source text not null default 'google_places',
  created_at timestamptz not null default now()
);

create table if not exists calls (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references search_tasks(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  call_sid text unique,
  status text not null default 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  transcript text,
  recording_url text,
  extraction_json jsonb,
  questions_json jsonb not null default '[]'::jsonb,
  disclosure_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists summaries (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references search_tasks(id) on delete cascade,
  final_summary text not null,
  recommendation_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists consent_disclosure_logs (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references search_tasks(id) on delete cascade,
  call_id uuid references calls(id) on delete cascade,
  event_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_tasks_user_created on search_tasks(user_id, created_at desc);
create unique index if not exists idx_users_external_subject on users(external_subject) where external_subject is not null;
create unique index if not exists idx_users_email_lower on users(lower(email)) where email is not null;
create index if not exists idx_users_request_count on users(request_count);
create index if not exists idx_businesses_task_score on businesses(task_id, relevance_score desc);
create index if not exists idx_calls_task_status on calls(task_id, status);
create index if not exists idx_calls_sid on calls(call_sid);
