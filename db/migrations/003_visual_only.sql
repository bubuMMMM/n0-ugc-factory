alter table if exists video_intelligence
  drop constraint if exists video_intelligence_audio_status_check;

alter table if exists video_intelligence
  add constraint video_intelligence_audio_status_check
  check (audio_status in ('unknown','none','detected','transcribed','error','ignored'));

update video_intelligence
set has_audio=false,
    audio_status='ignored',
    transcript=''
where status='ready'
  and (
    has_audio is distinct from false
    or audio_status is distinct from 'ignored'
    or transcript is distinct from ''
  );
