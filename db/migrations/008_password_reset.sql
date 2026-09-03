-- Recuperación de contraseña por código de 6 dígitos
create table if not exists password_reset (
  id text primary key,
  user_id text not null references app_user(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at text not null,
  used_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create index if not exists password_reset_email_idx on password_reset(email);
create index if not exists password_reset_user_idx on password_reset(user_id);
