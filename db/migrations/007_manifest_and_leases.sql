alter table if exists video_intelligence
  add column if not exists media_id text,
  add column if not exists manifest_version text;

create unique index if not exists video_intelligence_media_id_idx
  on video_intelligence(media_id)
  where media_id is not null;

alter table if exists video_intelligence
  add column if not exists analysis_attempt_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists lease_owner text,
  add column if not exists lease_expires_at timestamptz;
