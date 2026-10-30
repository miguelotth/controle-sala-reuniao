/*
    Testes de integração das regras de negócio.

    Usam um banco SEPARADO (padrão: controle_sala_reuniao_test),
    criado e limpo automaticamente. Nunca apontam para o banco real.

    Executar: npm test (com o MySQL rodando e o .env configurado)
*/
require("dotenv").config({ override: true });

process.env.DB_NAME =
    process.env.DB_NAME_TEST || "controle_sala_reuniao_test";

// Os testes usam sempre a autenticação em modo prévia
process.env.ENTRA_TENANT_ID = "";
process.env.ENTRA_CLIENT_ID = "";

const USUARIO = "Ana Souza";
const TOKEN = `Bearer previa:${encodeURIComponent(USUARIO)}`;

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");

let db;
let servidor;
let base;

const api = async (metodo, caminho, corpo, token = TOKEN) => {
    const headers = { "Content-Type": "application/json" };

    if (token) {
        headers.Authorization = token;
    }

    const resposta = await fetch(base + caminho, {
        method: metodo,
        headers,
        body: corpo ? JSON.stringify(corpo) : undefined
    });

    return {
        status: resposta.status,
        body: await resposta.json()
    };
};

const reserva = (data, hora_inicio, hora_fim, empresa, extra = {}) => ({
    data,
    hora_inicio,
    hora_fim,
    empresa,
    responsavel: "Teste",
    setor: "TI",
    ...extra
});

const criar = (...args) => api("POST", "/reservas", reserva(...args));

const status = async (id) => (await api("GET", `/reservas/${id}`)).body.status;

const minutos = (hora) => {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
};

const hora = (min) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

let FUTURO;
let ONTEM;
let HOJE;
let AGORA;

before(async () => {
    const conexao = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        multipleStatements: true
    });

    const fs = require("node:fs");
    const path = require("node:path");

    // Proteção: os testes apagam o banco, então só rodam num banco "_test"
    if (!process.env.DB_NAME.endsWith("_test")) {
        throw new Error("DB_NAME_TEST precisa terminar com _test");
    }

    const schema = fs
        .readFileSync(path.join(__dirname, "..", "database.sql"), "utf8")
        .replaceAll("controle_sala_reuniao", process.env.DB_NAME);

    // Recria o banco de teste para refletir sempre o schema atual
    await conexao.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
    await conexao.query(schema);
    await conexao.end();

    db = require("../db");

    const [[datas]] = await db.query(`
        SELECT
            CURDATE() AS hoje,
            CURDATE() + INTERVAL 2 DAY AS futuro,
            CURDATE() - INTERVAL 1 DAY AS ontem,
            CURTIME() AS agora
    `);

    HOJE = datas.hoje;
    FUTURO = datas.futuro;
    ONTEM = datas.ontem;
    AGORA = minutos(datas.agora);

    const app = require("../app");

    await new Promise((resolve) => {
        servidor = app.listen(0, resolve);
    });

    base = `http://localhost:${servidor.address().port}`;
});

after(async () => {
    servidor?.close();
    await db?.end();
});

beforeEach(async () => {
    await db.query("TRUNCATE TABLE reservas");
});

test("cria reserva em horário livre", async () => {
    const r = await criar(FUTURO, "09:00", "10:00", "GREEN");

    assert.equal(r.status, 201);
    assert.equal(await status(r.body.id), "AGENDADA");
});

test("GREEN contra GREEN bloqueia", async () => {
    await criar(FUTURO, "09:00", "10:00", "GREEN");

    const r = await criar(FUTURO, "09:30", "10:30", "GREEN");

    assert.equal(r.status, 409);
    assert.equal(r.body.erro, "CONFLITO");
});

test("MV contra GREEN bloqueia sem oferecer prioridade", async () => {
    await criar(FUTURO, "09:00", "10:00", "GREEN");

    const r = await criar(FUTURO, "09:30", "10:30", "MV");

    assert.equal(r.body.erro, "CONFLITO");
});

test("GREEN contra MV oferece prioridade", async () => {
    await criar(FUTURO, "09:00", "10:00", "MV");

    const r = await criar(FUTURO, "09:00", "10:00", "GREEN");

    assert.equal(r.body.erro, "PRIORIDADE_DISPONIVEL");
});

test("não aceita reserva no passado", async () => {
    const r = await criar(ONTEM, "09:00", "10:00", "MV");

    assert.equal(r.status, 400);
});

test("valida formato de data e hora", async () => {
    assert.equal((await criar("abc", "09:00", "10:00", "MV")).status, 400);
    assert.equal((await criar("2026-02-30", "09:00", "10:00", "MV")).status, 400);
    assert.equal((await criar(FUTURO, "08:00", "25:00", "MV")).status, 400);
});

test("sem token ou com token inválido devolve 401 em JSON", async () => {
    const semToken = await api("GET", "/reservas", undefined, null);

    assert.equal(semToken.status, 401);
    assert.ok(semToken.body.erro);

    const tokenInvalido = await api("GET", "/reservas", undefined, "Bearer abc");

    assert.equal(tokenInvalido.status, 401);
    assert.ok(tokenInvalido.body.erro);

    const semNome = await api("GET", "/reservas", undefined, "Bearer previa:");

    assert.equal(semNome.status, 401);
});

test("marcado_por é o usuário logado, ignorando o corpo", async () => {
    const r = await criar(FUTURO, "09:00", "10:00", "MV", {
        marcado_por: "Outra Pessoa"
    });

    assert.equal(r.status, 201);

    const salva = (await api("GET", `/reservas/${r.body.id}`)).body;

    assert.equal(salva.marcado_por, USUARIO);
    assert.equal(salva.empresa, "MV");

    const outroUsuario = `Bearer previa:${encodeURIComponent("Carlos Lima")}`;

    const edicao = await api(
        "PUT",
        `/reservas/${r.body.id}`,
        reserva(FUTURO, "09:00", "10:30", "MV", { marcado_por: "Outra Pessoa" }),
        outroUsuario
    );

    assert.equal(edicao.status, 200);

    // A edição não apaga quem marcou a reunião
    assert.equal(
        (await api("GET", `/reservas/${r.body.id}`)).body.marcado_por,
        USUARIO
    );
});

test("cancelamento registra quem cancelou e quando", async () => {
    const r = await criar(FUTURO, "11:00", "12:00", "MV");

    const antes = await api("GET", `/reservas/${r.body.id}`);

    assert.equal(antes.body.cancelado_por, null);
    assert.equal(antes.body.cancelado_em, null);

    const outroUsuario = `Bearer previa:${encodeURIComponent("Carlos Lima")}`;

    assert.equal(
        (await api("PATCH", `/reservas/${r.body.id}/cancelar`, null, outroUsuario)).status,
        200
    );

    const salva = (await api("GET", `/reservas/${r.body.id}`)).body;

    assert.equal(salva.status, "CANCELADA");
    assert.equal(salva.marcado_por, USUARIO);
    assert.equal(salva.cancelado_por, "Carlos Lima");
    assert.match(salva.cancelado_em, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    // Uma segunda tentativa recusada não troca quem cancelou
    await api("PATCH", `/reservas/${r.body.id}/cancelar`);

    assert.equal(
        (await api("GET", `/reservas/${r.body.id}`)).body.cancelado_por,
        "Carlos Lima"
    );
});

test("prioridade aplicada na edição mantém quem marcou", async () => {
    const mv = await criar(FUTURO, "14:00", "15:00", "MV");
    const green = await criar(FUTURO, "15:00", "16:00", "GREEN");

    const outroUsuario = `Bearer previa:${encodeURIComponent("Carlos Lima")}`;

    const r = await api(
        "POST",
        "/reservas/prioridade",
        { ...reserva(FUTURO, "14:00", "15:00"), id: green.body.id },
        outroUsuario
    );

    assert.equal(r.status, 200);
    assert.equal(await status(mv.body.id), "CONFLITO");

    const salva = (await api("GET", `/reservas/${green.body.id}`)).body;

    assert.equal(salva.marcado_por, USUARIO);
    assert.equal(salva.hora_inicio.slice(0, 5), "14:00");
});

test("lista reservas de um período com as duas datas inclusivas", async () => {
    const depois = (dias) => {
        const [a, m, d] = FUTURO.split("-").map(Number);
        const data = new Date(Date.UTC(a, m - 1, d + dias));
        return data.toISOString().slice(0, 10);
    };

    await criar(FUTURO, "09:00", "10:00", "GREEN");
    await criar(depois(3), "09:00", "10:00", "MV");
    await criar(depois(10), "09:00", "10:00", "EXTERNO");

    const r = await api("GET", `/reservas?data_inicio=${FUTURO}&data_fim=${depois(3)}`);

    assert.equal(r.status, 200);
    assert.deepEqual(r.body.map((x) => x.empresa), ["GREEN", "MV"]);

    assert.equal((await api("GET", "/reservas?data_inicio=abc")).status, 400);
    assert.equal(
        (await api("GET", `/reservas?data_inicio=${depois(3)}&data_fim=${FUTURO}`)).status,
        400
    );
});

test("JSON malformado devolve 400 em JSON", async () => {
    const resposta = await fetch(base + "/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: TOKEN },
        body: "{"
    });

    assert.equal(resposta.status, 400);
    assert.ok((await resposta.json()).erro);
});

test("pedidos simultâneos no mesmo horário criam só uma reserva", async () => {
    const respostas = await Promise.all(
        Array.from({ length: 20 }, () =>
            criar(FUTURO, "09:00", "10:00", "MV")
        )
    );

    assert.equal(respostas.filter(r => r.status === 201).length, 1);
});

test("prioridade na criação: MV vira CONFLITO e GREEN fica AGENDADA", async () => {
    const mv = await criar(FUTURO, "09:00", "10:00", "MV");

    const r = await api(
        "POST",
        "/reservas/prioridade",
        reserva(FUTURO, "09:00", "10:00")
    );

    assert.equal(r.status, 201);
    assert.equal(await status(mv.body.id), "CONFLITO");
    assert.equal(await status(r.body.id), "AGENDADA");
});

test("prioridade na edição atualiza a reserva original sem duplicar", async () => {
    const green = await criar(FUTURO, "14:00", "15:00", "GREEN");
    const mv = await criar(FUTURO, "16:00", "17:00", "MV");

    const edicao = await api(
        "PUT",
        `/reservas/${green.body.id}`,
        reserva(FUTURO, "16:00", "17:00", "GREEN")
    );

    assert.equal(edicao.body.erro, "PRIORIDADE_DISPONIVEL");

    const r = await api("POST", "/reservas/prioridade", {
        ...reserva(FUTURO, "16:00", "17:00"),
        id: green.body.id
    });

    assert.equal(r.status, 200);
    assert.equal(r.body.id, green.body.id);

    const lista = (await api("GET", `/reservas?data=${FUTURO}`)).body;
    const greens = lista.filter(x => x.empresa === "GREEN");

    assert.equal(greens.length, 1);
    assert.equal(greens[0].hora_inicio, "16:00:00");
    assert.equal(await status(mv.body.id), "CONFLITO");
});

test("prioridades simultâneas criam só uma reserva GREEN", async () => {
    await criar(FUTURO, "09:00", "10:00", "MV");

    await Promise.all(
        Array.from({ length: 5 }, () =>
            api("POST", "/reservas/prioridade", reserva(FUTURO, "09:00", "10:00"))
        )
    );

    const lista = (await api("GET", `/reservas?data=${FUTURO}`)).body;

    assert.equal(
        lista.filter(x => x.empresa === "GREEN" && x.status === "AGENDADA").length,
        1
    );
});

test("reserva cancelada não pode ser editada nem reativada", async () => {
    const r = await criar(FUTURO, "18:00", "19:00", "MV");

    await api("PATCH", `/reservas/${r.body.id}/cancelar`);

    const edicao = await api(
        "PUT",
        `/reservas/${r.body.id}`,
        reserva(FUTURO, "18:00", "19:00", "MV")
    );

    assert.equal(edicao.status, 409);
    assert.equal(await status(r.body.id), "CANCELADA");
});

test("cancelar duas vezes e cancelar reserva em CONFLITO são recusados", async () => {
    const r = await criar(FUTURO, "18:00", "19:00", "MV");

    assert.equal((await api("PATCH", `/reservas/${r.body.id}/cancelar`)).status, 200);
    assert.equal((await api("PATCH", `/reservas/${r.body.id}/cancelar`)).status, 409);

    const mv = await criar(FUTURO, "09:00", "10:00", "MV");
    await api("POST", "/reservas/prioridade", reserva(FUTURO, "09:00", "10:00"));

    assert.equal((await api("PATCH", `/reservas/${mv.body.id}/cancelar`)).status, 409);
    assert.equal((await api("PATCH", "/reservas/99999/cancelar")).status, 404);
});

test("reserva encerrada não pode ser cancelada, editada nem pausada", async () => {
    const [result] = await db.query(
        `INSERT INTO reservas (data, hora_inicio, hora_fim, responsavel, setor, empresa)
         VALUES (?, '09:00', '10:00', 'Teste', 'TI', 'MV')`,
        [ONTEM]
    );

    const id = result.insertId;

    assert.equal((await api("PATCH", `/reservas/${id}/cancelar`)).status, 409);
    assert.equal((await api("PATCH", `/reservas/${id}/standby`)).status, 409);
    assert.equal(
        (await api("PUT", `/reservas/${id}`, reserva(FUTURO, "09:00", "10:00", "MV"))).status,
        409
    );
});

test("retomar reunião futura com horário ocupado continua em STAND_BY", async () => {
    const r = await criar(FUTURO, "20:00", "21:00", "GREEN");

    await api("PATCH", `/reservas/${r.body.id}/standby`);
    await criar(FUTURO, "20:30", "21:00", "MV");

    const retomada = await api("PATCH", `/reservas/${r.body.id}/retomar`);

    assert.equal(retomada.body.erro, "RETOMADA_INDISPONIVEL");
    assert.equal(await status(r.body.id), "STAND_BY");
});

test("retomar reunião futura com horário livre volta a AGENDADA", async () => {
    const r = await criar(FUTURO, "20:00", "21:00", "GREEN");

    await api("PATCH", `/reservas/${r.body.id}/standby`);

    assert.equal((await api("PATCH", `/reservas/${r.body.id}/retomar`)).status, 200);
    assert.equal(await status(r.body.id), "AGENDADA");
});

test(
    "retomar reunião em andamento verifica o restante do intervalo",
    async (t) => {
        if (AGORA < 10 || AGORA > 22 * 60) {
            t.skip("perto da meia-noite");
            return;
        }

        // Reunião que começou 5 min atrás e termina em 1h
        const [result] = await db.query(
            `INSERT INTO reservas (data, hora_inicio, hora_fim, responsavel, setor, empresa, status)
             VALUES (?, ?, ?, 'Teste', 'TI', 'GREEN', 'STAND_BY')`,
            [HOJE, hora(AGORA - 5), hora(AGORA + 60)]
        );

        // Durante a pausa, alguém reservou o final do horário
        await criar(HOJE, hora(AGORA + 10), hora(AGORA + 60), "MV");

        const retomada = await api("PATCH", `/reservas/${result.insertId}/retomar`);

        assert.equal(retomada.body.erro, "RETOMADA_INDISPONIVEL");
        assert.equal(await status(result.insertId), "STAND_BY");
    }
);

// Data e hora (HH:MM) de daqui a N horas, pelo relógio do banco
const daquiA = async (horas) => {
    const [[r]] = await db.query(
        `SELECT
            DATE(NOW() + INTERVAL ? HOUR) AS data,
            TIME_FORMAT(NOW() + INTERVAL ? HOUR, '%H:%i') AS hora`,
        [horas, horas]
    );

    return r;
};

test("GREEN não pode tomar reserva que começa em menos de 24h", async (t) => {
    const inicio = await daquiA(23);

    if (minutos(inicio.hora) > 23 * 60) {
        t.skip("perto da meia-noite");
        return;
    }

    const fim = hora(minutos(inicio.hora) + 30);

    const mv = await criar(inicio.data, inicio.hora, fim, "MV");
    const green = await criar(inicio.data, inicio.hora, fim, "GREEN");

    assert.equal(green.body.erro, "CONFLITO");
    assert.match(green.body.mensagem, /24h/);

    // Nem chamando a rota de prioridade diretamente
    const direto = await api(
        "POST",
        "/reservas/prioridade",
        reserva(inicio.data, inicio.hora, fim)
    );

    assert.equal(direto.body.erro, "PRIORIDADE_FORA_DO_PRAZO");
    assert.equal(await status(mv.body.id), "AGENDADA");
});

test("GREEN pode tomar reserva que começa em mais de 24h", async (t) => {
    const inicio = await daquiA(25);

    if (minutos(inicio.hora) > 23 * 60) {
        t.skip("perto da meia-noite");
        return;
    }

    const fim = hora(minutos(inicio.hora) + 30);

    await criar(inicio.data, inicio.hora, fim, "MV");

    const green = await criar(inicio.data, inicio.hora, fim, "GREEN");

    assert.equal(green.body.erro, "PRIORIDADE_DISPONIVEL");
});

const reservaEmAndamento = async (inicio, fim) => {
    const [result] = await db.query(
        `INSERT INTO reservas (data, hora_inicio, hora_fim, responsavel, setor, empresa)
         VALUES (?, ?, ?, 'Teste', 'TI', 'GREEN')`,
        [HOJE, hora(inicio), hora(fim)]
    );

    return result.insertId;
};

test("encerrar agora libera o restante do horário", async (t) => {
    if (AGORA < 30 || AGORA > 22 * 60) {
        t.skip("perto da meia-noite");
        return;
    }

    const id = await reservaEmAndamento(AGORA - 20, AGORA + 60);

    const r = await api("PATCH", `/reservas/${id}/encerrar`);

    assert.equal(r.status, 200);

    const salva = (await api("GET", `/reservas/${id}`)).body;

    assert.equal(salva.hora_fim_prevista, `${hora(AGORA + 60)}:00`);
    assert.ok(minutos(salva.hora_fim) <= AGORA + 1);

    // Uma reunião rápida cabe no tempo liberado
    const rapida = await criar(HOJE, hora(AGORA + 5), hora(AGORA + 60), "MV");

    assert.equal(rapida.status, 201);
});

test("encerrar só vale para reunião em andamento", async () => {
    const futura = await criar(FUTURO, "09:00", "10:00", "GREEN");

    const r = await api("PATCH", `/reservas/${futura.body.id}/encerrar`);

    assert.equal(r.body.erro, "ENCERRAMENTO_NAO_PERMITIDO");
});

test("estender só até o início da próxima reserva", async (t) => {
    if (AGORA < 30 || AGORA > 21 * 60) {
        t.skip("perto da meia-noite");
        return;
    }

    const id = await reservaEmAndamento(AGORA - 20, AGORA + 30);

    // Próxima reserva começa 1h depois do fim
    await criar(HOJE, hora(AGORA + 90), hora(AGORA + 120), "MV");

    const demais = await api("PATCH", `/reservas/${id}/estender`, {
        hora_fim: hora(AGORA + 100)
    });

    assert.equal(demais.body.erro, "EXTENSAO_INDISPONIVEL");
    assert.equal(demais.body.limite, hora(AGORA + 90));

    const ok = await api("PATCH", `/reservas/${id}/estender`, {
        hora_fim: hora(AGORA + 90)
    });

    assert.equal(ok.status, 200);

    const salva = (await api("GET", `/reservas/${id}`)).body;

    assert.equal(salva.hora_fim, `${hora(AGORA + 90)}:00`);
    assert.equal(salva.hora_fim_prevista, `${hora(AGORA + 30)}:00`);
});

test("estender recusa horário anterior ao fim atual", async () => {
    const r = await criar(FUTURO, "09:00", "10:00", "GREEN");

    const menor = await api("PATCH", `/reservas/${r.body.id}/estender`, {
        hora_fim: "09:30"
    });

    assert.equal(menor.status, 400);
});
