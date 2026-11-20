-- Application tables. Timestamps are Unix milliseconds. Money is integer centavos.

create table quotations (
  id text not null primary key,
  user_id text not null references "user" (id) on delete cascade,
  quotation_number text not null,
  quotation_data text not null,          -- JSON, validated by the Worker before it is stored
  total_amount integer not null,         -- centavos, recomputed on the server
  created_at integer not null,
  updated_at integer not null
);
create index quotations_user_updated_idx on quotations (user_id, updated_at desc);

create table user_settings (
  user_id text not null primary key references "user" (id) on delete cascade,
  company_name text not null default '',
  company_address text not null default '',
  contact_number text not null default '',
  signatory_name text not null default '',
  signatory_position text not null default '',
  preferences text not null default '{}', -- JSON: defaultTemplate, validityDays
  updated_at integer not null
);

-- Logo and signature images. Private: only ever served to the owning, signed-in user.
create table user_assets (
  user_id text not null references "user" (id) on delete cascade,
  kind text not null check (kind in ('logo', 'signature')),
  mime text not null,
  data blob not null,
  updated_at integer not null,
  primary key (user_id, kind)
);

-- Aggregate usage counters: one row per day per metric. No per-visitor history is kept.
create table analytics_daily (
  day text not null,                     -- YYYY-MM-DD, Asia/Manila
  metric text not null,
  count integer not null default 0,
  primary key (day, metric)
);

-- Short-lived: used only to count approximate unique visitors and to rate-limit events.
-- visitor_hash is a keyed hash that changes every day; rows are deleted once the day has passed.
create table analytics_visitors (
  day text not null,
  visitor_hash text not null,
  hits integer not null default 1,
  primary key (day, visitor_hash)
);
