import { ShieldAlert, CalendarX2 } from "lucide-react";
import Modal from "../Modal";
import { formatDateBR, formatTime } from "../../utils/date";
import { empresaConfig } from "../../utils/status";
import "./ConflictModal.css";

export default function ConflictModal({ conflict, onClose, onUsePriority, loading }) {
  if (!conflict) return null;
  const isPriority = conflict.tipo === "PRIORIDADE_DISPONIVEL";
  const conflitante = conflict.reservas?.[0];

  return (
    <Modal open={!!conflict} onClose={onClose} width={460} title={isPriority ? "Prioridade disponível" : "Horário indisponível"}>
      <div className="gp-conflict">
        <div className={`gp-conflict-icon ${isPriority ? "gp-conflict-icon-priority" : "gp-conflict-icon-blocked"}`}>
          {isPriority ? <ShieldAlert size={22} /> : <CalendarX2 size={22} />}
        </div>

        <h3 className="gp-conflict-title">
          {isPriority ? "Prioridade disponível" : "Horário indisponível"}
        </h3>

        <p className="gp-conflict-desc">
          {isPriority
            ? "Existe uma reserva externa neste horário. A Green possui prioridade sobre reservas da MV ou externas."
            : conflict.mensagem || "Já existe uma reserva da sala nesse período."}
        </p>

        {conflitante && (
          <div className="gp-conflict-card">
            {conflitante.empresa && (
              <span
                className="gp-conflict-empresa"
                style={{ color: empresaConfig(conflitante.empresa).color, background: empresaConfig(conflitante.empresa).bg }}
              >
                {empresaConfig(conflitante.empresa).label}
              </span>
            )}
            <div className="gp-conflict-rows">
              {conflitante.responsavel && (
                <div>
                  <span>Responsável</span>
                  <strong>{conflitante.responsavel}</strong>
                </div>
              )}
              {conflitante.setor && (
                <div>
                  <span>Setor</span>
                  <strong>{conflitante.setor}</strong>
                </div>
              )}
              {(conflitante.hora_inicio || conflitante.hora_fim) && (
                <div>
                  <span>Horário</span>
                  <strong>
                    {formatTime(conflitante.hora_inicio)} — {formatTime(conflitante.hora_fim)}
                  </strong>
                </div>
              )}
              {conflitante.data && (
                <div>
                  <span>Data</span>
                  <strong>{formatDateBR(conflitante.data)}</strong>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="gp-conflict-actions">
          <button className="gp-btn gp-btn-secondary" onClick={onClose} disabled={loading}>
            Voltar
          </button>
          {isPriority && (
            <button className="gp-btn gp-btn-primary" onClick={onUsePriority} disabled={loading}>
              {loading ? "Aplicando…" : "Usar prioridade"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
