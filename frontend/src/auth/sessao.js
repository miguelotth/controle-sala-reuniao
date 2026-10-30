import { EventType, InteractionRequiredAuthError, PublicClientApplication } from "@azure/msal-browser";
import { MODO_PREVIA, CONFIG_INCOMPLETA, loginRequest, msalConfig } from "./authConfig";

/*
  Sessão do usuário fora do React, para que services/api.js
  consiga pegar o token em qualquer chamada.
*/
export const msalInstance =
  MODO_PREVIA || CONFIG_INCOMPLETA ? null : new PublicClientApplication(msalConfig);

export async function iniciarMsal() {
  if (!msalInstance) return;

  await msalInstance.initialize();

  const contas = msalInstance.getAllAccounts();
  if (!msalInstance.getActiveAccount() && contas.length > 0) {
    msalInstance.setActiveAccount(contas[0]);
  }

  msalInstance.addEventCallback((evento) => {
    if (evento.eventType === EventType.LOGIN_SUCCESS && evento.payload?.account) {
      msalInstance.setActiveAccount(evento.payload.account);
    }
  });
}

// ---- Modo prévia ----
const PREVIA_KEY = "gp-usuario-previa";

export function lerUsuarioPrevia() {
  try {
    const salvo = sessionStorage.getItem(PREVIA_KEY);
    return salvo ? JSON.parse(salvo) : null;
  } catch {
    return null;
  }
}

export function salvarUsuarioPrevia(usuario) {
  try {
    if (usuario) {
      sessionStorage.setItem(PREVIA_KEY, JSON.stringify(usuario));
    } else {
      sessionStorage.removeItem(PREVIA_KEY);
    }
  } catch {
    // Sem sessionStorage o login de prévia vale só até recarregar a página
  }
}

/** Token para o cabeçalho Authorization, ou null sem usuário logado. */
export async function obterToken() {
  if (MODO_PREVIA) {
    const usuario = lerUsuarioPrevia();
    return usuario ? `previa:${encodeURIComponent(usuario.nome)}` : null;
  }

  if (!msalInstance) return null;

  const conta = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!conta) return null;

  try {
    const resultado = await msalInstance.acquireTokenSilent({ ...loginRequest, account: conta });
    return resultado.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      await msalInstance.acquireTokenRedirect({ ...loginRequest, account: conta });
    }
    throw err;
  }
}
