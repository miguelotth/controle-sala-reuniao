import { FlaskConical } from "lucide-react";
import "./PreviewBanner.css";

/** Aviso fixo de que o login é simulado (sem Entra ID configurado). */
export default function PreviewBanner() {
  return (
    <div className="gp-preview-banner" role="note">
      <FlaskConical size={13} />
      Modo prévia – login simulado
    </div>
  );
}
