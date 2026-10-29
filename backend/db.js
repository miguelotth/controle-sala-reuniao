require("dotenv").config();

const mysql = require("mysql2/promise");

/*
    Pool em vez de uma única conexão:
    se o MySQL derrubar uma conexão (reinício, wait_timeout),
    o pool abre outra e o servidor continua de pé.
*/
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    dateStrings: true,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true
});

db.getConnection()
    .then((conexao) => {
        console.log("Banco conectado!");
        conexao.release();
    })
    .catch((err) => {
        console.error("Erro ao conectar ao banco:", err.message);
    });

/*
    Existe apenas uma sala, então toda operação que verifica
    disponibilidade e depois grava precisa ser feita "em fila".

    GET_LOCK garante que duas requisições simultâneas não
    passem pela verificação de conflito ao mesmo tempo, e a
    transação garante que tudo é gravado ou nada é.
*/
const NOME_LOCK = "controle_sala_reuniao";

const comTransacao = async (fn) => {
    const conexao = await db.getConnection();

    let lockObtido = false;

    try {
        const [[{ lock }]] = await conexao.query(
            "SELECT GET_LOCK(?, 10) AS `lock`",
            [NOME_LOCK]
        );

        if (lock !== 1) {
            const err = new Error("Sala ocupada por outra operação. Tente novamente.");
            err.status = 503;
            throw err;
        }

        lockObtido = true;

        await conexao.beginTransaction();

        try {
            const resultado = await fn(conexao);
            await conexao.commit();
            return resultado;
        } catch (err) {
            await conexao.rollback();
            throw err;
        }
    } finally {
        if (lockObtido) {
            await conexao
                .query("SELECT RELEASE_LOCK(?)", [NOME_LOCK])
                .catch(() => {});
        }

        conexao.release();
    }
};

module.exports = db;
module.exports.comTransacao = comTransacao;
