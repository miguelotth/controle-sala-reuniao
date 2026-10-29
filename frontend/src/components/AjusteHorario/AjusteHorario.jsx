import { TimerReset, CircleStop } from "lucide-react";
import { ajusteDeHorario, formatDuracao } from "../../utils/date";
import "./AjusteHorario.css";

/**
 * Etiqueta para reuniões que tiveram o fim alterado:
 * "Estendida +30min" ou "Encerrada 20min antes", com o fim previsto.
 */
export default function AjusteHorario({ reserva, mostrarPrevisto = true }) {
  const ajuste = ajusteDeHorario(reserva);
  if (!ajuste) return null;

  const estendida = ajuste.tipo === "estendida";
  const Icone = estendida ? TimerReset : CircleStop;
  const texto = estendida
    ? `Estendida +${formatDuracao(ajuste.minutos)}`
    : `Encerrada ${formatDuracao(ajuste.minutos)} antes`;

  return (
    <span
      className={`gp-ajuste gp-ajuste-${ajuste.tipo}`}
      title={`Fim previsto: ${ajuste.previsto}`}
    >
      <Icone size={12} />
      {texto}
      {mostrarPrevisto && <em>· previsto até {ajuste.previsto}</em>}
    </span>
  );
}
