-- Etapa 3: guarda o horário de fim original quando uma reunião
-- é encerrada antes do previsto ou estendida.
-- Faça backup antes de rodar:
--   mysqldump -u root -p controle_sala_reuniao > backup.sql
-- Depois:
--   mysql -u root -p controle_sala_reuniao < migrations/002_hora_fim_prevista.sql

ALTER TABLE reservas
    ADD COLUMN hora_fim_prevista TIME NULL AFTER hora_fim;
