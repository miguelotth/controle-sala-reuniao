const db = require("../../db");
const { comTransacao } = require("../../db");

const EMPRESAS_VALIDAS = ["GREEN", "MV", "EXTERNO"];

/*
    Erro de regra de negócio: interrompe a transação
    (rollback) e devolve o corpo informado ao frontend.
*/
class ErroRegra extends Error {
    constructor(status, body) {
        super(body.mensagem || body.erro);
        this.status = status;
        this.body = body;
    }
}

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const dataValida = (data) => {
    if (typeof data !== "string" || !REGEX_DATA.test(data)) {
        return false;
    }

    const [ano, mes, dia] = data.split("-").map(Number);
    const d = new Date(Date.UTC(ano, mes - 1, dia));

    return (
        d.getUTCFullYear() === ano &&
        d.getUTCMonth() === mes - 1 &&
        d.getUTCDate() === dia
    );
};

// "14:00:00" ou "14:00" -> "14:00"
const hhmm = (hora) => String(hora).slice(0, 5);

/*
    "marcado_por" é sempre o usuário logado (vem do token),
    nunca o que o frontend mandar no corpo. Na edição ele
    não muda: continua sendo quem marcou a reunião.
*/
const lerDadosReserva = (body = {}, usuario) => ({
    data: body.data,
    hora_inicio:
        typeof body.hora_inicio === "string"
            ? hhmm(body.hora_inicio)
            : body.hora_inicio,
    hora_fim:
        typeof body.hora_fim === "string"
            ? hhmm(body.hora_fim)
            : body.hora_fim,
    responsavel:
        typeof body.responsavel === "string"
            ? body.responsavel.trim()
            : body.responsavel,
    setor:
        typeof body.setor === "string"
            ? body.setor.trim()
            : body.setor,
    marcado_por: usuario?.nome,
    empresa: body.empresa,
    motivo:
        typeof body.motivo === "string" && body.motivo.trim()
            ? body.motivo.trim()
            : null
});

const validarDadosReserva = ({
    data,
    hora_inicio,
    hora_fim,
    responsavel,
    setor,
    empresa,
    marcado_por
}) => {
    if (
        !data ||
        !hora_inicio ||
        !hora_fim ||
        !responsavel ||
        !setor ||
        !empresa
    ) {
        return "Preencha todos os campos obrigatórios";
    }

    // Garantido pelo middleware de autenticação
    if (!marcado_por) {
        return "Não foi possível identificar o usuário logado";
    }

    if (!dataValida(data)) {
        return "Data inválida. Utilize o formato AAAA-MM-DD";
    }

    if (!REGEX_HORA.test(hora_inicio) || !REGEX_HORA.test(hora_fim)) {
        return "Horário inválido. Utilize o formato HH:MM";
    }

    if (!EMPRESAS_VALIDAS.includes(empresa)) {
        return "Empresa inválida. Utilize GREEN, MV ou EXTERNO";
    }

    if (hora_inicio >= hora_fim) {
        return "O horário inicial deve ser menor que o horário final";
    }

    return null;
};

/*
    Data e hora sempre vêm do MySQL, para que todas as
    regras usem o mesmo relógio.
*/
const agoraNoBanco = async (conexao) => {
    const [[agora]] = await conexao.query(
        "SELECT CURDATE() AS data, CURTIME() AS hora"
    );

    return {
        data: agora.data,
        hora: hhmm(agora.hora)
    };
};

const jaTerminou = (data, horaFim, agora) =>
    data < agora.data ||
    (data === agora.data && hhmm(horaFim) <= agora.hora);

const jaComecou = (data, horaInicio, agora) =>
    data < agora.data ||
    (data === agora.data && hhmm(horaInicio) < agora.hora);

/*
    Só reservas AGENDADAS bloqueiam a sala.

    STAND_BY = reunião pausada, portanto não ocupa a sala.
    CONFLITO = reserva que perdeu prioridade.
    CANCELADA = reserva cancelada.
*/
const buscarConflitos = async (
    conexao,
    { data, hora_inicio, hora_fim, ignorarId = null }
) => {
    const [conflitos] = await conexao.query(
        `
            SELECT *
            FROM reservas
            WHERE data = ?
            AND status = 'AGENDADA'
            AND hora_inicio < ?
            AND hora_fim > ?
            AND (? IS NULL OR id != ?)
            ORDER BY hora_inicio ASC
        `,
        [data, hora_fim, hora_inicio, ignorarId, ignorarId]
    );

    return conflitos;
};

/*
    A prioridade da GREEN só pode ser usada enquanto faltar
    MAIS de 24h para o início da reunião.

    Ex.: MV marca hoje às 9h para amanhã às 12h; a GREEN pode
    tomar o horário até hoje às 11h59. Uma reserva feita com
    menos de 24h de antecedência nunca pode ser tomada.
*/
const MENSAGEM_PRAZO_PRIORIDADE =
    "A prioridade da GREEN só pode ser usada com mais de 24h de antecedência do início da reunião.";

const prioridadeNoPrazo = async (conexao, data, horaInicio) => {
    const [[{ noPrazo }]] = await conexao.query(
        "SELECT TIMESTAMP(?, ?) > NOW() + INTERVAL 24 HOUR AS noPrazo",
        [data, horaInicio]
    );

    return noPrazo === 1;
};

/*
    GREEN contra reservas só de MV/EXTERNO, com mais de 24h
    de antecedência: oferece prioridade.
    Qualquer outro caso: conflito simples.
*/
const erroDeConflito = async (conexao, dados, conflitos) => {
    const existeReservaGreen = conflitos.some(
        reserva => reserva.empresa === "GREEN"
    );

    if (dados.empresa === "GREEN" && !existeReservaGreen) {
        if (await prioridadeNoPrazo(conexao, dados.data, dados.hora_inicio)) {
            return new ErroRegra(409, {
                erro: "PRIORIDADE_DISPONIVEL",
                mensagem:
                    "Existe uma reserva externa neste horário. A GREEN possui prioridade.",
                reservas: conflitos
            });
        }

        return new ErroRegra(409, {
            erro: "CONFLITO",
            mensagem:
                `Já existe uma reserva externa neste horário. ${MENSAGEM_PRAZO_PRIORIDADE}`,
            reservas: conflitos
        });
    }

    return new ErroRegra(409, {
        erro: "CONFLITO",
        mensagem: "Já existe uma reserva neste horário.",
        reservas: conflitos
    });
};

const buscarReservaParaAlterar = async (conexao, id) => {
    const [resultado] = await conexao.query(
        "SELECT * FROM reservas WHERE id = ? FOR UPDATE",
        [id]
    );

    if (resultado.length === 0) {
        throw new ErroRegra(404, {
            erro: "Reserva não encontrada"
        });
    }

    return resultado[0];
};

/*
    Regras de edição (também usadas quando a GREEN aplica
    prioridade editando uma reserva existente).
*/
const validarEdicao = (reservaAtual, dados, agora) => {
    if (
        reservaAtual.status === "CANCELADA" ||
        reservaAtual.status === "CONFLITO"
    ) {
        throw new ErroRegra(409, {
            erro: "EDICAO_NAO_PERMITIDA",
            mensagem:
                "Reservas canceladas ou em conflito não podem ser editadas."
        });
    }

    if (jaTerminou(reservaAtual.data, reservaAtual.hora_fim, agora)) {
        throw new ErroRegra(409, {
            erro: "EDICAO_NAO_PERMITIDA",
            mensagem:
                "Esta reunião já terminou e não pode mais ser editada."
        });
    }

    if (jaTerminou(dados.data, dados.hora_fim, agora)) {
        throw new ErroRegra(400, {
            erro: "O novo horário já passou."
        });
    }

    /*
        Uma reunião em andamento pode manter o horário inicial
        (por exemplo, para mudar só o fim), mas nenhuma reserva
        pode ser movida para começar no passado.
    */
    const mantemInicio =
        dados.data === reservaAtual.data &&
        dados.hora_inicio === hhmm(reservaAtual.hora_inicio);

    if (
        jaComecou(dados.data, dados.hora_inicio, agora) &&
        !mantemInicio
    ) {
        throw new ErroRegra(400, {
            erro: "Não é possível mover a reserva para um horário que já passou."
        });
    }
};

const listarReservas = async (req, res) => {
    const { data, data_inicio, data_fim, status, empresa } = req.query;

    // Período (ex.: semana ou mês do Dashboard), com as duas pontas inclusivas
    for (const valor of [data_inicio, data_fim]) {
        if (valor !== undefined && !dataValida(valor)) {
            return res.status(400).json({
                erro: "Período inválido. Use datas no formato AAAA-MM-DD."
            });
        }
    }

    if (data_inicio && data_fim && data_inicio > data_fim) {
        return res.status(400).json({
            erro: "A data inicial do período deve ser anterior à data final."
        });
    }

    let sql = `
        SELECT *
        FROM reservas
        WHERE 1 = 1
    `;

    const valores = [];

    if (data) {
        sql += " AND data = ?";
        valores.push(data);
    }

    if (data_inicio) {
        sql += " AND data >= ?";
        valores.push(data_inicio);
    }

    if (data_fim) {
        sql += " AND data <= ?";
        valores.push(data_fim);
    }

    if (status) {
        sql += " AND status = ?";
        valores.push(status);
    }

    if (empresa) {
        sql += " AND empresa = ?";
        valores.push(empresa);
    }

    sql += " ORDER BY data ASC, hora_inicio ASC";

    const [results] = await db.query(sql, valores);

    res.json(results);
};

const buscarReservaPorId = async (req, res) => {
    const { id } = req.params;

    const [results] = await db.query(
        "SELECT * FROM reservas WHERE id = ?",
        [id]
    );

    if (results.length === 0) {
        return res.status(404).json({
            erro: "Reserva não encontrada"
        });
    }

    res.json(results[0]);
};

const criarReserva = async (req, res) => {
    const dados = lerDadosReserva(req.body, req.usuario);

    const erroValidacao = validarDadosReserva(dados);

    if (erroValidacao) {
        return res.status(400).json({
            erro: erroValidacao
        });
    }

    const id = await comTransacao(async (conexao) => {
        const agora = await agoraNoBanco(conexao);

        if (jaComecou(dados.data, dados.hora_inicio, agora)) {
            throw new ErroRegra(400, {
                erro: "Não é possível reservar um horário que já passou."
            });
        }

        const conflitos = await buscarConflitos(conexao, dados);

        if (conflitos.length > 0) {
            throw await erroDeConflito(conexao, dados, conflitos);
        }

        const [result] = await conexao.query(
            `
                INSERT INTO reservas
                (
                    data,
                    hora_inicio,
                    hora_fim,
                    responsavel,
                    setor,
                    marcado_por,
                    empresa,
                    motivo,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AGENDADA')
            `,
            [
                dados.data,
                dados.hora_inicio,
                dados.hora_fim,
                dados.responsavel,
                dados.setor,
                dados.marcado_por,
                dados.empresa,
                dados.motivo
            ]
        );

        return result.insertId;
    });

    res.status(201).json({
        mensagem: "Reserva criada com sucesso",
        id,
        status: "AGENDADA"
    });
};

/*
    Sem "id": cria uma nova reserva GREEN.
    Com "id": atualiza essa reserva (fluxo de edição), em vez
    de criar uma segunda reserva GREEN.

    Tudo acontece numa transação: se algo falhar, as reservas
    externas não ficam em CONFLITO à toa.
*/
const aplicarPrioridade = async (req, res) => {
    const id = req.body?.id ?? null;

    const dados = lerDadosReserva(
        {
            ...req.body,
            empresa: "GREEN"
        },
        req.usuario
    );

    const erroValidacao = validarDadosReserva(dados);

    if (erroValidacao) {
        return res.status(400).json({
            erro: erroValidacao
        });
    }

    const resultado = await comTransacao(async (conexao) => {
        const agora = await agoraNoBanco(conexao);

        if (id !== null) {
            const reservaAtual = await buscarReservaParaAlterar(conexao, id);

            validarEdicao(reservaAtual, dados, agora);
        } else if (jaComecou(dados.data, dados.hora_inicio, agora)) {
            throw new ErroRegra(400, {
                erro: "Não é possível reservar um horário que já passou."
            });
        }

        const conflitos = await buscarConflitos(conexao, {
            ...dados,
            ignorarId: id
        });

        if (conflitos.length === 0) {
            throw new ErroRegra(400, {
                erro: "Nenhum conflito encontrado para aplicar prioridade"
            });
        }

        if (conflitos.some(reserva => reserva.empresa === "GREEN")) {
            throw new ErroRegra(409, {
                erro: "CONFLITO_INTERNO",
                mensagem:
                    "Já existe uma reserva da GREEN neste horário."
            });
        }

        if (!(await prioridadeNoPrazo(conexao, dados.data, dados.hora_inicio))) {
            throw new ErroRegra(409, {
                erro: "PRIORIDADE_FORA_DO_PRAZO",
                mensagem: MENSAGEM_PRAZO_PRIORIDADE
            });
        }

        const idsExternos = conflitos.map(reserva => reserva.id);

        await conexao.query(
            `
                UPDATE reservas
                SET status = 'CONFLITO'
                WHERE id IN (?)
            `,
            [idsExternos]
        );

        const valores = [
            dados.data,
            dados.hora_inicio,
            dados.hora_fim,
            dados.responsavel,
            dados.setor
        ];

        if (id !== null) {
            await conexao.query(
                `
                    UPDATE reservas
                    SET
                        data = ?,
                        hora_inicio = ?,
                        hora_fim = ?,
                        responsavel = ?,
                        setor = ?,
                        empresa = 'GREEN',
                        motivo = ?,
                        status = 'AGENDADA',
                        hora_fim_prevista = NULL
                    WHERE id = ?
                `,
                [...valores, dados.motivo, id]
            );

            return { id, idsExternos, criada: false };
        }

        const [result] = await conexao.query(
            `
                INSERT INTO reservas
                (
                    data,
                    hora_inicio,
                    hora_fim,
                    responsavel,
                    setor,
                    marcado_por,
                    empresa,
                    motivo,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, 'GREEN', ?, 'AGENDADA')
            `,
            [...valores, dados.marcado_por, dados.motivo]
        );

        return { id: result.insertId, idsExternos, criada: true };
    });

    res.status(resultado.criada ? 201 : 200).json({
        mensagem: "Prioridade aplicada com sucesso",
        id: resultado.id,
        reservasAfetadas: resultado.idsExternos
    });
};

const editarReserva = async (req, res) => {
    const { id } = req.params;

    const dados = lerDadosReserva(req.body, req.usuario);

    const erroValidacao = validarDadosReserva(dados);

    if (erroValidacao) {
        return res.status(400).json({
            erro: erroValidacao
        });
    }

    await comTransacao(async (conexao) => {
        const agora = await agoraNoBanco(conexao);

        const reservaAtual = await buscarReservaParaAlterar(conexao, id);

        validarEdicao(reservaAtual, dados, agora);

        /*
            Uma reserva em STAND_BY não está ocupando a sala.
            Portanto ela pode ser editada sem tentar retomá-la.
        */
        if (reservaAtual.status !== "STAND_BY") {
            const conflitos = await buscarConflitos(conexao, {
                ...dados,
                ignorarId: id
            });

            if (conflitos.length > 0) {
                throw await erroDeConflito(conexao, dados, conflitos);
            }
        }

        await conexao.query(
            `
                UPDATE reservas
                SET
                    data = ?,
                    hora_inicio = ?,
                    hora_fim = ?,
                    responsavel = ?,
                    setor = ?,
                    empresa = ?,
                    motivo = ?,
                    hora_fim_prevista = NULL
                WHERE id = ?
            `,
            [
                dados.data,
                dados.hora_inicio,
                dados.hora_fim,
                dados.responsavel,
                dados.setor,
                dados.empresa,
                dados.motivo,
                id
            ]
        );
    });

    res.json({
        mensagem: "Reserva atualizada com sucesso"
    });
};

const pausarReserva = async (req, res) => {
    const { id } = req.params;

    // Reunião que já terminou não pode ser pausada
    const [result] = await db.query(
        `
            UPDATE reservas
            SET status = 'STAND_BY'
            WHERE id = ?
            AND status = 'AGENDADA'
            AND (
                data > CURDATE()
                OR (data = CURDATE() AND hora_fim > CURTIME())
            )
        `,
        [id]
    );

    if (result.affectedRows === 0) {
        return res.status(409).json({
            erro: "STAND_BY_NAO_PERMITIDO",
            mensagem:
                "Somente reservas agendadas que ainda não terminaram podem ser colocadas em stand by."
        });
    }

    res.json({
        mensagem: "Reunião colocada em stand by com sucesso",
        status: "STAND_BY"
    });
};

const retomarReserva = async (req, res) => {
    const { id } = req.params;

    await comTransacao(async (conexao) => {
        const reserva = await buscarReservaParaAlterar(conexao, id);

        if (reserva.status !== "STAND_BY") {
            throw new ErroRegra(409, {
                erro: "RETOMADA_NAO_PERMITIDA",
                mensagem:
                    "Somente reuniões em stand by podem ser retomadas."
            });
        }

        const agora = await agoraNoBanco(conexao);

        if (jaTerminou(reserva.data, reserva.hora_fim, agora)) {
            throw new ErroRegra(409, {
                erro: "REUNIAO_ENCERRADA",
                mensagem:
                    "O horário desta reunião já terminou. Ela não pode mais ser retomada."
            });
        }

        /*
            Se a reunião já começou, verificamos de agora até o fim.
            Se ainda não começou, verificamos o intervalo inteiro.

            Nos dois casos o restante do intervalo precisa estar
            livre, senão a retomada criaria uma sobreposição com
            reservas feitas durante a pausa.
        */
        const inicioVerificacao = jaComecou(
            reserva.data,
            reserva.hora_inicio,
            agora
        )
            ? agora.hora
            : hhmm(reserva.hora_inicio);

        const conflitos = await buscarConflitos(conexao, {
            data: reserva.data,
            hora_inicio: inicioVerificacao,
            hora_fim: hhmm(reserva.hora_fim),
            ignorarId: id
        });

        if (conflitos.length > 0) {
            const conflito = conflitos[0];

            throw new ErroRegra(409, {
                erro: "RETOMADA_INDISPONIVEL",
                mensagem:
                    `Não é possível retomar esta reunião porque outra reserva ocupa o horário das ${hhmm(conflito.hora_inicio)} às ${hhmm(conflito.hora_fim)}.`,
                reservas: conflitos
            });
        }

        await conexao.query(
            `
                UPDATE reservas
                SET status = 'AGENDADA'
                WHERE id = ?
            `,
            [id]
        );
    });

    res.json({
        mensagem: "Reunião retomada com sucesso",
        status: "AGENDADA"
    });
};

/*
    A reunião acabou antes do previsto: o fim passa a ser o
    horário atual e o restante do intervalo fica livre para
    novas reservas (que precisam caber até a próxima reserva).

    O fim original fica guardado em hora_fim_prevista.
*/
const encerrarReserva = async (req, res) => {
    const { id } = req.params;

    const horaFim = await comTransacao(async (conexao) => {
        const reserva = await buscarReservaParaAlterar(conexao, id);

        const agora = await agoraNoBanco(conexao);

        if (
            reserva.status !== "AGENDADA" ||
            !jaComecou(reserva.data, reserva.hora_inicio, agora) ||
            jaTerminou(reserva.data, reserva.hora_fim, agora)
        ) {
            throw new ErroRegra(409, {
                erro: "ENCERRAMENTO_NAO_PERMITIDO",
                mensagem:
                    "Somente reuniões agendadas que estão em andamento podem ser encerradas."
            });
        }

        await conexao.query(
            `
                UPDATE reservas
                SET
                    hora_fim_prevista = COALESCE(hora_fim_prevista, hora_fim),
                    hora_fim = ?
                WHERE id = ?
            `,
            [agora.hora, id]
        );

        return agora.hora;
    });

    res.json({
        mensagem: "Reunião encerrada. O restante do horário está livre.",
        hora_fim: horaFim
    });
};

/*
    A reunião precisa de mais tempo: o novo fim pode ir, no
    máximo, até o início da próxima reserva agendada.
*/
const estenderReserva = async (req, res) => {
    const { id } = req.params;

    const novoFim =
        typeof req.body?.hora_fim === "string"
            ? hhmm(req.body.hora_fim)
            : null;

    if (!novoFim || !REGEX_HORA.test(novoFim)) {
        return res.status(400).json({
            erro: "Informe o novo horário final no formato HH:MM"
        });
    }

    await comTransacao(async (conexao) => {
        const reserva = await buscarReservaParaAlterar(conexao, id);

        const agora = await agoraNoBanco(conexao);

        if (
            reserva.status !== "AGENDADA" ||
            jaTerminou(reserva.data, reserva.hora_fim, agora)
        ) {
            throw new ErroRegra(409, {
                erro: "EXTENSAO_NAO_PERMITIDA",
                mensagem:
                    "Somente reuniões agendadas que ainda não terminaram podem ser estendidas."
            });
        }

        if (novoFim <= hhmm(reserva.hora_fim)) {
            throw new ErroRegra(400, {
                erro: "O novo horário final deve ser depois do fim atual."
            });
        }

        const conflitos = await buscarConflitos(conexao, {
            data: reserva.data,
            hora_inicio: hhmm(reserva.hora_fim),
            hora_fim: novoFim,
            ignorarId: id
        });

        if (conflitos.length > 0) {
            const limite = hhmm(conflitos[0].hora_inicio);

            throw new ErroRegra(409, {
                erro: "EXTENSAO_INDISPONIVEL",
                mensagem:
                    `Só é possível estender até ${limite}, quando começa a próxima reserva.`,
                limite,
                reservas: conflitos
            });
        }

        await conexao.query(
            `
                UPDATE reservas
                SET
                    hora_fim_prevista = COALESCE(hora_fim_prevista, hora_fim),
                    hora_fim = ?
                WHERE id = ?
            `,
            [novoFim, id]
        );
    });

    res.json({
        mensagem: "Horário estendido com sucesso",
        hora_fim: novoFim
    });
};

const cancelarReserva = async (req, res) => {
    const { id } = req.params;

    /*
        Só reservas ativas (AGENDADA ou STAND_BY) que ainda
        não terminaram podem ser canceladas.

        Fica registrado quem cancelou (usuário logado) e quando.
    */
    const [result] = await db.query(
        `
            UPDATE reservas
            SET
                status = 'CANCELADA',
                cancelado_por = ?,
                cancelado_em = NOW()
            WHERE id = ?
            AND status IN ('AGENDADA', 'STAND_BY')
            AND (
                data > CURDATE()
                OR (data = CURDATE() AND hora_fim > CURTIME())
            )
        `,
        [req.usuario?.nome, id]
    );

    if (result.affectedRows === 0) {
        const [existe] = await db.query(
            "SELECT id FROM reservas WHERE id = ?",
            [id]
        );

        if (existe.length === 0) {
            return res.status(404).json({
                erro: "Reserva não encontrada"
            });
        }

        return res.status(409).json({
            erro: "CANCELAMENTO_NAO_PERMITIDO",
            mensagem:
                "Somente reservas ativas que ainda não terminaram podem ser canceladas."
        });
    }

    res.json({
        mensagem: "Reserva cancelada com sucesso"
    });
};

module.exports = {
    listarReservas,
    buscarReservaPorId,
    criarReserva,
    aplicarPrioridade,
    editarReserva,
    pausarReserva,
    retomarReserva,
    encerrarReserva,
    estenderReserva,
    cancelarReserva
};
