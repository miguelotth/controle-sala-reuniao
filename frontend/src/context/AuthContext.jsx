import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { MODO_PREVIA, CONFIG_INCOMPLETA, loginRequest } from "../auth/authConfig";
import { lerUsuarioPrevia, msalInstance, salvarUsuarioPrevia } from "../auth/sessao";

const AuthContext = createContext(null);

function PreviaAuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => lerUsuarioPrevia());

  // No modo prévia, "entrar" recebe o usuário de teste escolhido
  const entrar = useCallback((usuarioTeste) => {
    const novo = { nome: usuarioTeste.nome, email: usuarioTeste.email };
    salvarUsuarioPrevia(novo);
    setUsuario(novo);
  }, []);

  const sair = useCallback(() => {
    salvarUsuarioPrevia(null);
    setUsuario(null);
  }, []);

  const value = useMemo(
    () => ({ usuario, entrar, sair, carregando: false, modoPrevia: true }),
    [usuario, entrar, sair]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function MsalAuthBridge({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const conta = instance.getActiveAccount() || accounts[0] || null;

  const usuario = useMemo(
    () => (conta ? { nome: conta.name || conta.username, email: conta.username } : null),
    [conta]
  );

  const entrar = useCallback(() => instance.loginRedirect(loginRequest), [instance]);

  const sair = useCallback(
    () => instance.logoutRedirect({ account: instance.getActiveAccount() }),
    [instance]
  );

  const value = useMemo(
    () => ({
      usuario,
      entrar,
      sair,
      carregando: inProgress !== InteractionStatus.None,
      modoPrevia: false,
    }),
    [usuario, entrar, sair, inProgress]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ConfigIncompletaProvider({ children }) {
  const value = useMemo(
    () => ({
      usuario: null,
      entrar: () => {},
      sair: () => {},
      carregando: false,
      modoPrevia: false,
      erroConfig:
        "Login mal configurado: preencha VITE_ENTRA_TENANT_ID e VITE_ENTRA_CLIENT_ID no .env do frontend (ou deixe os dois vazios para o modo prévia).",
    }),
    []
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }) {
  if (MODO_PREVIA) return <PreviaAuthProvider>{children}</PreviaAuthProvider>;
  if (CONFIG_INCOMPLETA) return <ConfigIncompletaProvider>{children}</ConfigIncompletaProvider>;

  return (
    <MsalProvider instance={msalInstance}>
      <MsalAuthBridge>{children}</MsalAuthBridge>
    </MsalProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
