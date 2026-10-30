import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App.jsx";
import { iniciarMsal } from "./auth/sessao";

// O MSAL precisa estar pronto (e ter lido o retorno do login) antes de renderizar
iniciarMsal()
  .catch((err) => console.error("Falha ao iniciar o login da Microsoft:", err))
  .finally(() => {
    createRoot(document.getElementById("root")).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  });
