const express = require("express");
const cors = require("cors");

const db = require("./db");

const reservasRoutes = require("./src/routes/reservasRoutes");
const autenticar = require("./src/middleware/autenticacao");

const app = express();

/*
    Em produção o site e a API ficam no mesmo endereço (o Nginx
    repassa /api), então o CORS só importa em desenvolvimento.
    CORS_ORIGIN limita quem pode chamar a API de outro endereço.
*/
const origensPermitidas = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origem) => origem.trim())
    .filter(Boolean);

app.use(cors(origensPermitidas.length ? { origin: origensPermitidas } : undefined));
app.use(express.json());

// Usado pelo Docker para saber se a API e o banco estão de pé
app.get("/saude", async (req, res) => {
    try {
        await db.query("SELECT 1");
        res.json({ ok: true });
    } catch {
        res.status(503).json({ ok: false, erro: "Sem conexão com o banco" });
    }
});

app.use("/reservas", autenticar, reservasRoutes);

// Erros não tratados nas rotas sempre voltam em JSON
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            erro: "JSON inválido no corpo da requisição"
        });
    }

    // Erros de regra de negócio já trazem o corpo da resposta pronto
    if (err.body) {
        return res.status(err.status).json(err.body);
    }

    if (err.status && err.status < 500) {
        return res.status(err.status).json({
            erro: err.message
        });
    }

    console.error(err);

    res.status(err.status || 500).json({
        erro: err.status === 503 ? err.message : "Erro interno do servidor"
    });
});

module.exports = app;
