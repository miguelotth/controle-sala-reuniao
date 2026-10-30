-- Registra quem cancelou a reunião e quando.
-- Faça backup antes de rodar:
--   mysqldump -u root -p controle_sala_reuniao > backup.sql
-- Depois:
--   mysql -u root -p controle_sala_reuniao < migrations/003_cancelado_por.sql
--
-- Reservas canceladas antes desta versão ficam com os campos vazios (NULL).

ALTER TABLE reservas
    ADD COLUMN cancelado_por VARCHAR(100) NULL AFTER marcado_por,
    ADD COLUMN cancelado_em DATETIME NULL AFTER cancelado_por;
