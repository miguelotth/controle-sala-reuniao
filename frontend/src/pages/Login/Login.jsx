import { useState } from "react";
import { AlertCircle, ArrowLeft, UserRound } from "lucide-react";
import Logo from "../../components/Logo/Logo";
import ThemeToggle from "../../components/ThemeToggle/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import { USUARIOS_TESTE } from "../../auth/authConfig";
import "./Login.css";

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function Login() {
  const { entrar, carregando, modoPrevia, erroConfig } = useAuth();
  const [escolhendo, setEscolhendo] = useState(false);
  const [erro, setErro] = useState("");

  async function handleEntrar() {
    setErro("");
    if (modoPrevia) {
      setEscolhendo(true);
      return;
    }
    try {
      await entrar();
    } catch {
      setErro("Não foi possível abrir o login da Microsoft. Tente novamente.");
    }
  }

  return (
    <div className="gp-login">
      <div className="gp-login-theme">
        <ThemeToggle />
      </div>

      <main className="gp-login-card gp-card">
        <Logo className="gp-login-logo" />

        <div className="gp-login-text">
          <h1>Sala de reunião</h1>
          <p>Entre com sua conta Microsoft da Green Paperless para ver a agenda e reservar a sala.</p>
        </div>

        {(erroConfig || erro) && (
          <div className="gp-login-alert" role="alert">
            <AlertCircle size={16} />
            <span>{erroConfig || erro}</span>
          </div>
        )}

        {escolhendo ? (
          <div className="gp-login-users">
            <span className="gp-login-users-title">Escolha um usuário de teste</span>
            {USUARIOS_TESTE.map((u) => (
              <button
                key={u.email}
                type="button"
                className="gp-login-user"
                onClick={() => entrar(u)}
              >
                <span className="gp-login-user-avatar">
                  <UserRound size={16} />
                </span>
                <span className="gp-login-user-info">
                  <strong>
                    {u.nome} ({u.empresa})
                  </strong>
                  <small>{u.email}</small>
                </span>
              </button>
            ))}
            <button
              type="button"
              className="gp-btn gp-btn-ghost gp-btn-sm gp-login-back"
              onClick={() => setEscolhendo(false)}
            >
              <ArrowLeft size={15} /> Voltar
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="gp-btn gp-btn-primary gp-login-btn"
            onClick={handleEntrar}
            disabled={carregando || Boolean(erroConfig)}
          >
            <MicrosoftIcon />
            {carregando ? "Entrando…" : "Entrar com Microsoft"}
          </button>
        )}

        <p className="gp-login-footnote">Acesso restrito a colaboradores da Green Paperless.</p>
      </main>
    </div>
  );
}
