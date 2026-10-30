/*
  Configuração do login com Microsoft Entra ID.

  Sem VITE_ENTRA_TENANT_ID e VITE_ENTRA_CLIENT_ID no .env, o app
  entra em MODO PRÉVIA: o login é simulado com usuários de teste.
*/
const tenantId = (import.meta.env.VITE_ENTRA_TENANT_ID || "").trim();
const clientId = (import.meta.env.VITE_ENTRA_CLIENT_ID || "").trim();

export const MODO_PREVIA = !tenantId && !clientId;

// Só um dos dois preenchido: o login real não tem como funcionar
export const CONFIG_INCOMPLETA = !MODO_PREVIA && (!tenantId || !clientId);

export const msalConfig = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: [`api://${clientId}/access_as_user`],
};

export const USUARIOS_TESTE = [
  { nome: "Ana Souza", empresa: "GREEN", email: "ana.souza@greenpaperless.test" },
  { nome: "Carlos Lima", empresa: "GREEN", email: "carlos.lima@greenpaperless.test" },
];
