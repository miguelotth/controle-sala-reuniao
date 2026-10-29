-- Etapa 2: registra o colaborador da GREEN que marcou a reunião.
-- Faça backup antes de rodar:
--   mysqldump -u root -p controle_sala_reuniao > backup.sql
-- Depois:
--   mysql -u root -p controle_sala_reuniao < migrations/001_marcado_por.sql
--
-- Reservas antigas ficam com marcado_por vazio (NULL).

ALTER TABLE reservas
    ADD COLUMN marcado_por VARCHAR(100) NULL AFTER setor;
