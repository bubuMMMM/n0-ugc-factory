create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists video_intelligence (
  id uuid primary key default gen_random_uuid(),
  canonical_index integer not null unique check (canonical_index > 0),
  source_url text not null unique,
  duration_ms integer,
  analysis_version text not null default 'video-intel-v1',
  status text not null default 'pending' check (status in ('pending','processing','ready','error')),
  scene text,
  action text,
  primary_emotion text,
  emotions text[] not null default '{}',
  objects text[] not null default '{}',
  gestures text[] not null default '{}',
  person_count integer,
  has_phone boolean,
  has_computer boolean,
  has_product boolean,
  gaze_direction text,
  reaction_intensity integer check (reaction_intensity between 0 and 100),
  energy_score integer check (energy_score between 0 and 100),
  versatility_score integer check (versatility_score between 0 and 100),
  reaction_type text,
  visual_focus text,
  peak_moment_ms integer,
  peak_reason text,
  text_safe_zone jsonb not null default '{}'::jsonb,
  face_regions jsonb not null default '[]'::jsonb,
  object_regions jsonb not null default '[]'::jsonb,
  hook_compatibility text[] not null default '{}',
  tags text[] not null default '{}',
  keyframes jsonb not null default '[]'::jsonb,
  contact_sheet_data text,
  has_audio boolean,
  audio_status text not null default 'unknown' check (audio_status in ('unknown','none','detected','transcribed','error')),
  transcript text,
  embedding_text text,
  embedding_model text,
  embedding vector(1536),
  raw_analysis jsonb not null default '{}'::jsonb,
  error_message text,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_profiles (
  id uuid primary key default gen_random_uuid(),
  website text not null,
  domain text not null,
  analysis_version text not null default 'brand-intel-v2',
  profile jsonb not null,
  embedding_model text,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists brand_signals (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  signal_type text not null check (signal_type in ('pain','desire','objection','benefit','proof','differentiator','faq','angle','customer_language','job')),
  text text not null,
  source_url text,
  evidence text,
  weight real not null default 1,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create table if not exists video_brand_matches (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  video_id uuid not null references video_intelligence(id) on delete cascade,
  brand_signal_id uuid references brand_signals(id) on delete set null,
  semantic_similarity real,
  emotion_match real,
  reaction_match real,
  versatility real,
  compatibility_score real not null,
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (brand_profile_id, video_id)
);

create table if not exists hook_assignments (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references brand_profiles(id) on delete cascade,
  video_id uuid not null references video_intelligence(id) on delete cascade,
  brand_signal_id uuid references brand_signals(id) on delete set null,
  hook text not null,
  second_line text,
  mechanism text,
  visual_anchor text,
  brand_anchor text,
  placement text,
  visual_fit integer,
  brand_fit integer,
  hook_strength integer,
  specificity integer,
  naturalness integer,
  claim_safety integer,
  novelty integer,
  readability integer,
  emotion_match integer,
  quality_score integer,
  accepted boolean not null default false,
  rationale text,
  generator_version text not null default 'hook-v3',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_profile_id, video_id)
);

create index if not exists video_intelligence_status_idx on video_intelligence(status);
create index if not exists video_intelligence_reaction_idx on video_intelligence(reaction_type);
create index if not exists video_intelligence_tags_idx on video_intelligence using gin(tags);
create index if not exists video_intelligence_hook_compat_idx on video_intelligence using gin(hook_compatibility);
create index if not exists brand_signals_profile_idx on brand_signals(brand_profile_id);
create index if not exists video_brand_matches_profile_score_idx on video_brand_matches(brand_profile_id, compatibility_score desc);

do $$
begin
  if not exists (select 1 from pg_indexes where indexname='video_intelligence_embedding_hnsw') then
    create index video_intelligence_embedding_hnsw
      on video_intelligence using hnsw (embedding vector_cosine_ops);
  end if;
  if not exists (select 1 from pg_indexes where indexname='brand_signals_embedding_hnsw') then
    create index brand_signals_embedding_hnsw
      on brand_signals using hnsw (embedding vector_cosine_ops);
  end if;
end $$;

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists video_intelligence_touch on video_intelligence;
create trigger video_intelligence_touch before update on video_intelligence
for each row execute function touch_updated_at();

drop trigger if exists brand_profiles_touch on brand_profiles;
create trigger brand_profiles_touch before update on brand_profiles
for each row execute function touch_updated_at();

drop trigger if exists hook_assignments_touch on hook_assignments;
create trigger hook_assignments_touch before update on hook_assignments
for each row execute function touch_updated_at();
