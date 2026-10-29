const express = require("express");
const cors = require("cors");

const reservasRoutes = require("./src/routes/reservasRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/reservas", reservasRoutes);

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
