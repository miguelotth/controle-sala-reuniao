// O .env tem prioridade sobre variáveis já definidas no sistema
require("dotenv").config({ override: true });

const app = require("./app");
const { modoPrevia, configEntra } = require("./src/middleware/autenticacao");

const PORTA = Number(process.env.PORT) || 3000;
const producao = process.env.NODE_ENV === "production";

if (modoPrevia()) {
    // Em produção o modo prévia deixa qualquer um entrar com qualquer nome
    if (producao && process.env.PERMITIR_MODO_PREVIA !== "sim") {
        console.error(
            "ERRO: o servidor está em produção sem ENTRA_TENANT_ID e ENTRA_CLIENT_ID. " +
            "Preencha os dois no .env, ou defina PERMITIR_MODO_PREVIA=sim só para um teste rápido."
        );
        process.exit(1);
    }

    console.warn("AUTENTICAÇÃO EM MODO PRÉVIA – não usar em produção");
} else {
    const { tenantId, clientId } = configEntra();

    if (!tenantId || !clientId) {
        console.error("ERRO: preencha ENTRA_TENANT_ID e ENTRA_CLIENT_ID (os dois) no .env.");
        process.exit(1);
    }

    console.log("Login com Microsoft Entra ID ativado");
}

app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
});
