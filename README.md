# Green Meeting Room

Sistema interno da Green Paperless para reservar a sala de reunião. Substitui a planilha de Excel: mostra a agenda da sala, impede reservas em horários ocupados e aplica a prioridade da Green sobre reservas de MV e externos.

## Stack

| Parte | Tecnologia | Endereço local |
| --- | --- | --- |
| Frontend | React + Vite (JavaScript, CSS puro) | http://localhost:5173 |
| Backend | Node.js + Express (API REST) | http://localhost:3000 |
| Banco | MySQL 8 (`controle_sala_reuniao`) | localhost:3306 |

O frontend nunca acessa o banco direto: tudo passa pela API.

## Como rodar

Pré-requisitos: Node.js 20 ou mais recente e MySQL 8.

### 1. Banco de dados

Crie o banco e a tabela com o script do projeto:

```bash
mysql -u root -p < backend/database.sql
```

Se o banco já existia antes, aplique as migrações de `backend/migrations/`, em ordem, só das colunas que ainda não existem (`SHOW COLUMNS FROM reservas`).

### 2. Backend

```bash
cd backend
cp .env.example .env    # preencha DB_PASSWORD e os demais dados do seu MySQL
npm install
npm run dev
```

Os valores do `.env` têm prioridade sobre variáveis de ambiente do sistema com o mesmo nome.

### 3. Frontend

Em outro terminal:

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

Abra http://localhost:5173.

Para outras pessoas da mesma rede acessarem, rode `npm run dev -- --host` e troque `VITE_API_URL` pelo IP da máquina (ex.: `http://192.168.0.10:3000`).

> Os arquivos `.env` têm senhas e ficam só na sua máquina. Nunca faça commit deles.

## Testes

```bash
cd backend
npm test
```

Os testes cobrem as regras de negócio (criação, prioridade, edição, cancelamento, pausa, encerrar e estender). Eles usam um banco separado, `controle_sala_reuniao_test`, criado e apagado automaticamente, e nunca tocam no banco real.

## Regras de negócio

Existe uma sala só: duas reservas ativas não podem se sobrepor.

**Empresas:** `GREEN` (prioritária), `MV` e `EXTERNO`. Toda reserva registra o colaborador da Green que fez a marcação.

**Status**

| Status | Significado | Ocupa a sala? |
| --- | --- | --- |
| `AGENDADA` | Reserva ativa | Sim |
| `STAND_BY` | Reunião pausada temporariamente | Não |
| `CONFLITO` | Perdeu o horário para a prioridade da Green | Não |
| `CANCELADA` | Cancelada (nunca é apagada) | Não |

**Prioridade da Green**

- Green sobre MV/Externo: o sistema oferece aplicar a prioridade. A reserva externa vira `CONFLITO` e a da Green fica `AGENDADA`.
- A prioridade só vale com mais de 24h de antecedência do início da reunião.
- Green contra Green bloqueia. MV/Externo sobre uma reserva ativa também bloqueia.
- Na edição, a prioridade atualiza a reserva original, sem criar outra.

**Durante a reunião**

- Pausar (`STAND_BY`) libera a sala. Ao retomar, se o horário tiver sido ocupado, a reunião continua pausada e o usuário é avisado.
- Encerrar antes libera o restante do horário.
- Estender só vai até o início da próxima reserva. O fim original fica guardado e aparece no histórico como "Estendida" ou "Encerrada antes".

Operações que mexem em mais de uma reserva usam transação MySQL e uma trava (`GET_LOCK`) para evitar duas reservas no mesmo horário ao mesmo tempo. Toda validação é feita no backend; o frontend só avisa antes.

## API

Base: `http://localhost:3000/reservas`

| Método | Rota | Ação |
| --- | --- | --- |
| GET | `/` | Lista. Filtros: `data`, `data_inicio`, `data_fim`, `status`, `empresa` |
| GET | `/:id` | Busca uma reserva |
| POST | `/` | Cria |
| POST | `/prioridade` | Aplica a prioridade da Green |
| PUT | `/:id` | Edita |
| PATCH | `/:id/standby` | Pausa |
| PATCH | `/:id/retomar` | Retoma |
| PATCH | `/:id/encerrar` | Encerra antes do horário |
| PATCH | `/:id/estender` | Estende o horário final (`{ "hora_fim": "HH:MM" }`) |
| PATCH | `/:id/cancelar` | Cancela |

## Estrutura

```
backend/
  server.js, app.js, db.js      entrada, rotas e conexão com o MySQL
  src/controllers/              regras de negócio
  src/routes/                   rotas da API
  database.sql, migrations/     schema do banco
  test/                         testes das regras
frontend/
  src/pages/                    Dashboard, Agenda, Reservas, Histórico, Configurações
  src/components/               componentes da interface
  src/hooks/, src/services/     estado e chamadas à API
  src/utils/                    datas, status e checagem de disponibilidade
  src/styles/                   tokens de cor e estilos globais (modo claro e escuro)
```

## Próximos passos

- Login e permissões: cada pessoa só edita, pausa e cancela as próprias reservas.
- Preparação para produção: hospedagem, HTTPS, backups e logs.
- Integração com Outlook/Teams (Microsoft Graph).
