-- Run this in your Supabase SQL editor to set up the database schema

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Flows (detected user flows per project)
create table flows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  description text,
  steps jsonb not null default '[]',
  click_events jsonb default '[]',
  frames_dir text,
  duration_ms integer,
  dom_snapshot text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Clips (one clip per flow, reviewable by user)
create table clips (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references flows(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  narration_script text,
  voice text not null default 'nova',
  music text not null default 'soft-ambient',
  audio_url text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Final stitched videos
create table final_videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  video_url text not null,
  title text,
  clip_count integer,
  created_at timestamptz not null default now()
);

-- Agent log entries (streamed to frontend)
create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  message text not null,
  level text not null default 'info',
  timestamp timestamptz not null default now()
);

-- Indexes
create index on flows(project_id);
create index on clips(project_id);
create index on clips(flow_id);
create index on agent_logs(project_id);
create index on agent_logs(timestamp);

-- Auto-update updated_at on projects
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- Enable Realtime on agent_logs and clips so the frontend gets live updates
alter publication supabase_realtime add table agent_logs;
alter publication supabase_realtime add table clips;
alter publication supabase_realtime add table projects;
