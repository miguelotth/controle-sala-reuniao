# Green Meeting Room

Sistema interno da Green Paperless para reservar a sala de reunião. Substitui a planilha de Excel: mostra a agenda da sala, impede reservas em horários ocupados e aplica a prioridade da Green sobre reservas de MV e externos.

## Stack

| Parte | Tecnologia | Endereço local |
| --- | --- | --- |
| Frontend | React + Vite (JavaScript, CSS puro) | http://localhost:5173 |
| Backend | Node.js + Express (API REST) | http://localhost:3000 |
| Banco | MySQL 8 (`controle_sala_reuniao`) | localhost:3306 |

O frontend nunca acessa o banco direto: tudo passa pela API.

## Rodar com Docker

O Docker roda o banco, o backend e o frontend em containers, sem instalar Node.js nem MySQL na máquina. Pré-requisito: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (no Windows, com WSL 2: `wsl --install` como administrador e reiniciar).

```bash
cp .env.example .env    # opcional: troque DB_PASSWORD e, se tiver, os IDs do Entra
docker compose up -d --build
```

| Container | Endereço |
| --- | --- |
| `frontend` (nginx com o build do React) | http://localhost:5173 |
| `backend` (API) | http://localhost:3000 |
| `db` (MySQL 8) | localhost:3307 (usuário `root`, senha `DB_PASSWORD`) |

Na primeira subida o MySQL cria a tabela com `backend/database.sql`. Os dados ficam no volume `dados_mysql` e continuam lá depois de `docker compose down`; só `docker compose down -v` apaga o banco.

Comandos do dia a dia:

```bash
docker compose ps                 # o que está rodando
docker compose logs -f backend    # logs da API
docker compose up -d --build      # depois de mudar o código ou o .env
docker compose down               # para tudo (mantém os dados)
```

Os `.env` de `backend/` e `frontend/` não são usados pelo Docker: ele lê só o `.env` da raiz.

O site chama a API pelo próprio endereço, em `/api` (o nginx repassa para o backend). Assim outras máquinas da rede abrem `http://<ip-da-maquina>:5173` sem configurar nada.

## Instalar no servidor da empresa

O `docker-compose.prod.yml` é a versão para o servidor. Diferenças do teste local:

- O site abre em **HTTPS** (porta 443). A porta 80 só redireciona para o HTTPS. A Microsoft exige HTTPS para o login fora do `localhost`.
- A API fica em `https://<servidor>/api`. O banco e a API não ficam abertos na rede, só o site.
- O backend usa um usuário próprio do MySQL (`sala`), com acesso só ao banco do sistema.
- Sem os IDs do Entra o backend não sobe, para o modo prévia não ir para produção por engano.
- Backup automático do banco todo dia na pasta `backups/`.

### O que pedir antes

| Para quem | O quê |
| --- | --- |
| TI | Servidor com Docker instalado (Linux com Docker Engine, ou Windows Server com Docker). Portas 80 e 443 liberadas na rede interna. |
| TI | De preferência um nome para o servidor (ex.: `sala.green.local`) e um certificado HTTPS para ele, emitido pela autoridade da empresa, para o navegador não mostrar aviso. |
| Administrador do Azure | App registration conforme [Login com Entra ID](#login-com-entra-id), com o redirect `https://<endereço do servidor>`. Passar o Tenant ID e o Client ID. |

### Passo a passo

1. Baixe o projeto no servidor:

   ```bash
   git clone https://github.com/Benjamim-Brito/controle-sala-reuniao.git
   cd controle-sala-reuniao
   ```

2. Crie o `.env` a partir do modelo e preencha (endereço, duas senhas novas e os IDs do Entra):

   ```bash
   cp .env.producao.example .env
   ```

3. Certificado HTTPS: coloque os arquivos da TI na pasta `certs/` com os nomes `certificado.crt` (certificado, com a cadeia) e `certificado.key` (chave). Sem eles, o sistema cria um certificado provisório na primeira subida: funciona, mas cada navegador mostra um aviso de segurança que precisa ser aceito.

4. Suba tudo:

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. Confira: `docker compose -f docker-compose.prod.yml ps` deve mostrar `db`, `backend`, `frontend` e `backup` rodando (o `certificado` roda uma vez e sai). Abra `https://<endereço do servidor>`.

O MySQL cria as senhas na primeira subida, com o banco vazio. Trocar `DB_PASSWORD` no `.env` depois não muda a senha do banco que já existe; para isso, troque também dentro do MySQL (`ALTER USER 'sala'@'%' IDENTIFIED BY '...'`).

Se mudar `PORTA_HTTPS` para outra que não a 443, o redirecionamento da porta 80 não funciona: use o endereço com a porta (`https://servidor:8443`) e cadastre esse mesmo endereço no Entra ID.

### Atualizar para uma versão nova

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Os dados ficam no volume `dados_mysql`. Nunca use `down -v` no servidor: o `-v` apaga o banco.

Se o banco já existia e a versão nova tiver migração em `backend/migrations/`, aplique antes:

```bash
docker compose -f docker-compose.prod.yml exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" controle_sala_reuniao' < backend/migrations/<arquivo>.sql
```

### Backup

O container `backup` salva o banco ao subir e depois todo dia em `BACKUP_HORA`, na pasta `backups/` do servidor (`sala-reuniao_AAAA-MM-DD_HHMM.sql.gz`). Arquivos com mais de `BACKUP_DIAS` dias são apagados. Peça à TI para copiar essa pasta para outro lugar (outro disco ou o backup da rede): se o servidor perder o disco, os backups vão junto.

Para restaurar um backup (substitui o banco atual inteiro):

```bash
gunzip < backups/sala-reuniao_2026-10-27_0200.sql.gz | docker compose -f docker-compose.prod.yml exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"'
```

### Problemas comuns

```bash
docker compose -f docker-compose.prod.yml logs -f backend    # erros da API
docker compose -f docker-compose.prod.yml logs -f frontend   # erros do nginx/HTTPS
```

- **Backend reiniciando sem parar:** veja o log. Sem `ENTRA_TENANT_ID` e `ENTRA_CLIENT_ID` no `.env` ele não sobe de propósito. Para um teste rápido antes de ter os IDs, `PERMITIR_MODO_PREVIA=sim` (depois volte para `nao`).
- **Mudei o `.env` e nada mudou:** os IDs do Entra entram no build do site; rode de novo com `--build`.
- **Erro do login "redirect URI mismatch":** o endereço cadastrado no Entra precisa ser exatamente o do navegador, com `https://` e sem barra no final.

## Como rodar sem Docker

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

## Login com Entra ID

O sistema inteiro exige login com a conta Microsoft da empresa. O nome do usuário logado é gravado automaticamente como "marcado por" em cada reserva.

**Modo prévia (sem Azure):** com `VITE_ENTRA_TENANT_ID`/`VITE_ENTRA_CLIENT_ID` (frontend) e `ENTRA_TENANT_ID`/`ENTRA_CLIENT_ID` (backend) vazios, o botão "Entrar com Microsoft" mostra usuários de teste e o login é simulado. Uma faixa "Modo prévia – login simulado" aparece na tela e o backend avisa no console. Serve só para testar; não usar em produção.

**Login real:** o administrador do Azure precisa:

1. Criar um **App registration** em Microsoft Entra ID, tipo **single tenant** (só contas da organização).
2. Em **Authentication**, adicionar a plataforma **Single-page application (SPA)** com os redirects `http://localhost:5173` (testes) e `https://<endereço do servidor>` (ex.: `https://172.16.81.102` ou `https://sala.green.local`), sem barra no final.
3. Em **Expose an API**, definir o Application ID URI `api://<client-id>` e criar o escopo `access_as_user`.
4. No **Manifest**, definir `"requestedAccessTokenVersion": 2` (no manifest antigo: `"accessTokenAcceptedVersion": 2`) (a API confere o emissor v2 do tenant).
5. Passar o **Directory (tenant) ID** e o **Application (client) ID**. No Docker eles vão no `.env` da raiz; sem Docker, nos `.env` do frontend e do backend.

Não é preciso client secret: os dois IDs não são senhas. Fora de `localhost`, o app precisa rodar em **HTTPS** (exigência da Microsoft para o redirect), por isso o `docker-compose.prod.yml` já sobe com HTTPS.

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

Base: `http://localhost:3000/reservas` (no Docker, também `<site>/api/reservas`). `GET /saude` responde sem login e confere a conexão com o banco. Todas as rotas exigem `Authorization: Bearer <token>`; sem token a API responde `401`.

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
  nginx.conf, nginx.prod.conf   nginx do teste local (HTTP) e do servidor (HTTPS)
scripts/                        backup do banco e certificado provisório (Docker)
docker-compose.yml              teste local
docker-compose.prod.yml         servidor da empresa
```

## Próximos passos

- Permissões: cada pessoa só edita, pausa e cancela as próprias reservas.
- Integração com Outlook/Teams (Microsoft Graph).
