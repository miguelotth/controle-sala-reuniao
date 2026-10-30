const { createRemoteJWKSet, jwtVerify } = require("jose");

/*
    Autenticação das rotas da API.

    Com ENTRA_TENANT_ID e ENTRA_CLIENT_ID no .env: valida o
    token de acesso do Microsoft Entra ID (assinatura pelas
    chaves públicas do tenant, emissor e audiência).

    Sem eles: MODO PRÉVIA. Aceita "Bearer previa:<nome>",
    enviado pelo login simulado do frontend. Só para testes.
*/
const PREFIXO_PREVIA = "previa:";

const configEntra = () => ({
    tenantId: (process.env.ENTRA_TENANT_ID || "").trim(),
    clientId: (process.env.ENTRA_CLIENT_ID || "").trim()
});

const modoPrevia = () => {
    const { tenantId, clientId } = configEntra();
    return !tenantId && !clientId;
};

// As chaves do tenant ficam em cache pelo próprio jose
let jwks = null;
let jwksTenant = null;

const chavesDoTenant = (tenantId) => {
    if (!jwks || jwksTenant !== tenantId) {
        jwks = createRemoteJWKSet(
            new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)
        );
        jwksTenant = tenantId;
    }

    return jwks;
};

const naoAutorizado = (res, erro) => res.status(401).json({ erro });

const usuarioPrevia = (token) => {
    let nome = "";

    try {
        nome = decodeURIComponent(token.slice(PREFIXO_PREVIA.length)).trim();
    } catch {
        nome = "";
    }

    return nome ? { nome, email: null } : null;
};

const autenticar = async (req, res, next) => {
    const cabecalho = req.headers.authorization || "";
    const [tipo, token] = cabecalho.split(" ");

    if (tipo !== "Bearer" || !token) {
        return naoAutorizado(res, "Faça login para acessar o sistema.");
    }

    if (modoPrevia()) {
        const usuario = token.startsWith(PREFIXO_PREVIA)
            ? usuarioPrevia(token)
            : null;

        if (!usuario) {
            return naoAutorizado(res, "Token de prévia inválido.");
        }

        req.usuario = usuario;
        return next();
    }

    const { tenantId, clientId } = configEntra();

    if (!tenantId || !clientId) {
        return res.status(500).json({
            erro: "Login com Entra ID mal configurado: informe ENTRA_TENANT_ID e ENTRA_CLIENT_ID."
        });
    }

    try {
        const { payload } = await jwtVerify(token, chavesDoTenant(tenantId), {
            issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
            audience: [`api://${clientId}`, clientId]
        });

        const nome = payload.name || payload.preferred_username;

        if (!nome) {
            return naoAutorizado(res, "O token não informa o nome do usuário.");
        }

        req.usuario = {
            nome,
            email: payload.preferred_username || null
        };

        next();
    } catch {
        naoAutorizado(res, "Sessão inválida ou expirada. Faça login novamente.");
    }
};

module.exports = autenticar;
module.exports.modoPrevia = modoPrevia;
module.exports.configEntra = configEntra;
