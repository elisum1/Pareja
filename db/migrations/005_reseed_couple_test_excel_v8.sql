-- Reseed Evaluador de Relaciones (Excel CUESTIONARIO v8): 10 categorías, 45 preguntas.
-- Excluidas (sin marca SI en el Excel):
--   Comunicación: expectativas financieras/emocionales/familiares periódicas
--   Convivencia social: quehaceres del hogar (fila 41)
--   Organización: reparto equilibrado de quehaceres del hogar (solo queda vida diaria)
-- Importante: borra respuestas porque los id de preguntas cambian.
delete from test_response;
delete from test_question;
delete from sqlite_sequence where name = 'test_question';

insert into test_question (category_key, category_order, question_order, text) values
('eco',1,1,'¿Tu pareja es responsable en el manejo de su dinero?'),
('eco',1,2,'¿Cumple el acuerdo financiero que han establecido juntos?'),
('eco',1,3,'¿Es transparente contigo respecto a sus ingresos, gastos, inversiones y/o deudas?'),
('eco',1,4,'¿Sientes que maneja el dinero de forma justa para ambos?'),
('eco',1,5,'¿Pueden hablar de dinero sin que esto genere tensión innecesaria?'),
('respeto',2,1,'¿Sientes admiración por tu pareja? ¿Eres su Fan?'),
('respeto',2,2,'Cuando discuten, ¿tu pareja evita insultos, gritos o descalificaciones personales?'),
('respeto',2,3,'¿Respeta tus opiniones, decisiones y límites personales?'),
('respeto',2,4,'¿Evita conductas que te hieran emocionalmente (burlas, humillación, manipulación)?'),
('respeto',2,5,'¿Te sientes seguro (a) y tratado (a) con cuidado en lo físico y emocional?'),
('tolerancia',3,1,'¿Es tolerante con tus creencias religiosas?'),
('tolerancia',3,2,'¿Es tolerante con tus gustos personales (deportes, música, hobbies, etc.) sin intentar cambiarlos?'),
('tolerancia',3,3,'¿Acepta tus hábitos cotidianos (rutinas, horarios, modo de hacer las cosas)?'),
('tolerancia',3,4,'¿Toleras sus modales al comer?'),
('tolerancia',3,5,'¿Toleras su forma de dormir?'),
('confianza',4,1,'¿Sientes la libertad de conversar por teléfono con quien necesites sin sentirte vigilado (a) y obligado (a) a justificarlo?'),
('confianza',4,2,'¿Puedes hablar con cualquier persona sin que tu pareja te haga luego celos molestos?'),
('confianza',4,3,'¿Puedes asistir a ciertos eventos o lugares sin que tu pareja te haga luego algún reclamo?'),
('confianza',4,4,'¿Confías en que tu pareja no busca controlar tus amistades o actividades fuera de la relación?'),
('confianza',4,5,'¿Confía en ti sin necesidad de revisar tu teléfono o redes sociales?'),
('confianza',4,6,'¿Puedes pedirle que te permita revisar sus redes sociales o hacerlo sin aviso?'),
('comunicacion',5,1,'¿Sientes que te escucha con atención cuando le hablas?'),
('comunicacion',5,2,'¿Puedes expresarle tus emociones sin miedo a reacciones negativas o burlas?'),
('comunicacion',5,3,'¿Pueden hablar de desacuerdos sin que la conversación se convierta en una discusión fuerte?'),
('comunicacion',5,4,'¿Al momento de comunicarse por lo general llegan a un acuerdo común?'),
('comunicacion',5,5,'¿Le comunicas a tu pareja tus problemas antes que a otra persona?'),
('comunicacion',5,6,'¿Le comunicas a tu pareja tus alegrías o éxitos antes que a otra persona?'),
('comunicacion',5,7,'¿Le comunicas a tu pareja tus tristezas antes que a otra persona?'),
('diversion',6,1,'¿Crees que mensualmente son suficientes las actividades recreativas con tu pareja?'),
('diversion',6,2,'¿Estás satisfecho (a) con las actividades recreativas que te propone?'),
('diversion',6,3,'¿Al momento de divertirse lo pueden hacer ustedes solos como pareja?'),
('diversion',6,4,'¿Consideras que pasan suficiente tiempo de calidad juntos?'),
('intimidad',7,1,'¿Te satisface sexualmente?'),
('intimidad',7,2,'¿Estás satisfecho (a) con la frecuencia en que tienen intimidad?'),
('intimidad',7,3,'¿Te sientes deseado (a) por tu pareja?'),
('intimidad',7,4,'¿Muestra interés en complacerte y adaptarse a tus necesidades o gustos íntimos?'),
('intimidad',7,5,'¿Te sientes cómodo (a) hablando de temas íntimos con tu pareja?'),
('convivencia_social',8,1,'¿Consideras que la manera en que se relaciona socialmente con tus familiares, encaja bien contigo?'),
('convivencia_social',8,2,'¿Consideras que la manera en que se relaciona socialmente con tus amistades, encaja bien contigo?'),
('convivencia_social',8,3,'¿Respeta tu tiempo con familiares y amistades?'),
('convivencia_social',8,4,'¿Te acompaña cuando es importante para ti hacerlo en eventos sociales?'),
('cuidado_personal',9,1,'¿Te sientes cómodo (a) con la manera en que tu pareja maneja el consumo de sustancias nocivas para la salud (drogas, alcohol, tabaco)?'),
('cuidado_personal',9,2,'¿Su estilo de vida (alimentación, sueño, ejercicio) contribuye positivamente a la relación?'),
('cuidado_personal',9,3,'¿Mantiene una higiene y apariencia personal que te parece adecuada?'),
('organizacion',10,1,'¿Es organizada con su vida diaria?');

delete from user_priority;
