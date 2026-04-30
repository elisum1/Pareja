pragma foreign_keys = on;

create table if not exists app_user (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists user_priority (
  user_id text not null references app_user(id) on delete cascade,
  category_key text not null,
  rank integer not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  primary key (user_id, category_key),
  unique (user_id, rank)
);

create table if not exists couple (
  id text primary key,
  user_a_id text not null references app_user(id) on delete cascade,
  user_b_id text not null references app_user(id) on delete cascade,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  constraint couple_distinct_users check (user_a_id <> user_b_id)
);

create table if not exists invite (
  id text primary key,
  inviter_user_id text not null references app_user(id) on delete cascade,
  accepted_user_id text references app_user(id) on delete set null,
  phone_e164 text not null,
  token text not null unique,
  status text not null check (status in ('pending','accepted','expired')),
  expires_at text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists test_question (
  id integer primary key autoincrement,
  category_key text not null,
  category_order integer not null,
  question_order integer not null,
  text text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create unique index if not exists test_question_order_unique on test_question(category_key, question_order);

create table if not exists test_response (
  id text primary key,
  user_id text not null unique references app_user(id) on delete cascade,
  answers text not null default '{}',
  completed integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at text
);

create table if not exists relation_test_result (
  id text primary key,
  user_id text not null references app_user(id) on delete cascade,
  test_type text not null check (test_type in ('amigos','conocidos','familia')),
  answers text not null default '{}',
  score real not null default 0,
  classification text not null check (classification in ('CRITICO','MEJORABLE','SALUDABLE')),
  by_category text not null default '[]',
  tips text not null default '[]',
  completed integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at text,
  unique(user_id, test_type)
);

insert into test_question (category_key, category_order, question_order, text) values
('eco',1,1,'¿Cuentas con el apoyo económico de tu pareja cuando te hace falta dinero?'),
('eco',1,2,'¿Comparte contigo su dinero?'),
('eco',1,3,'¿Es tu pareja responsable económicamente?'),
('respeto',2,1,'¿Es tu pareja respetuosa al hablarte?'),
('respeto',2,2,'¿Es respetuosa al hablar cuando discuten?'),
('respeto',2,3,'¿Te trata bien psicológicamente?'),
('respeto',2,4,'¿Te trata bien físicamente?'),
('tolerancia',3,1,'¿Es tolerante con tus creencias religiosas?'),
('tolerancia',3,2,'¿Es tolerante con tus gustos personales (deportes, música, hobbies, etc.)?'),
('tolerancia',3,3,'¿Toleras su forma de vestir?'),
('tolerancia',3,4,'¿Toleras su forma de hablar?'),
('tolerancia',3,5,'¿Toleras su forma de comer?'),
('tolerancia',3,6,'¿Toleras su forma de dormir?'),
('confianza',4,1,'¿Puedes hablar por teléfono con cualquier persona sin tener luego que decirle a tu pareja con quién estabas hablando?'),
('confianza',4,2,'¿Puedes hablar con cualquier persona sin que tu pareja te haga luego celos molestos?'),
('confianza',4,3,'¿Puedes asistir a ciertos eventos o lugares sin que tu pareja te haga luego algún reclamo?'),
('comunicacion',5,1,'¿Le comunicas a tu pareja tus problemas antes que a otra persona?'),
('comunicacion',5,2,'¿Al momento de comunicarse por lo general llegan a un acuerdo común?'),
('comunicacion',5,3,'¿Le comunicas a tu pareja tus alegrías o éxitos antes que a otra persona?'),
('comunicacion',5,4,'¿Le comunicas a tu pareja tus tristezas antes que a otra persona?'),
('diversion',6,1,'¿Crees que mensualmente son suficientes las actividades recreativas con tu pareja?'),
('diversion',6,2,'¿Estás satisfecho (a) con las actividades recreativas que le propone su pareja?'),
('diversion',6,3,'¿Al momento de divertirse lo pueden hacer ustedes solos como pareja?'),
('sexo',7,1,'¿Te satisface sexualmente tu pareja?'),
('sexo',7,2,'¿Estás satisfecho (a) con la regularidad en que tienen relaciones sexuales?'),
('sexo',7,3,'¿Te gusta su aroma corporal al momento de tener relaciones?'),
('social',8,1,'¿Es sociable con tus familiares?'),
('social',8,2,'¿Es sociable con tus amistades?'),
('social',8,3,'¿Es sociable con tus colegas y/o compañeros de trabajo?'),
('social',8,4,'¿Es sociable con personas extrañas?'),
('salud',9,1,'¿Tu pareja se mantiene alejada de los vicios nocivos para la salud (drogas, alcohol, tabaco)?'),
('salud',9,2,'¿Maneja tu pareja una alimentación adecuada?'),
('salud',9,3,'¿Hace ejercicio físico su pareja?'),
('salud',9,4,'¿Tiene buenos hábitos higiénicos?'),
('organizacion',10,1,'¿Es su pareja organizada en sus quehaceres del hogar?'),
('organizacion',10,2,'¿Es organizada con su vida diaria?'),
('fisico',11,1,'¿Te agrada el rostro de tu pareja?'),
('fisico',11,2,'¿Te agrada el dorso de tu pareja?'),
('fisico',11,3,'¿Te agrada el abdomen de tu pareja?'),
('fisico',11,4,'¿Te agradan los brazos de tu pareja?'),
('fisico',11,5,'¿Te agradan las piernas de tu pareja?')
on conflict(category_key, question_order) do update set
  category_order=excluded.category_order,
  text=excluded.text;
