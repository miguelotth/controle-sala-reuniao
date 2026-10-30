import { useEffect, useMemo, useState } from "react";
import { CalendarDays, AlertCircle, AlertTriangle, CircleCheck } from "lucide-react";
import Modal from "../Modal";
import { toISODate, timeToMinutes } from "../../utils/date";
import { avaliarHorario, descreverConflito } from "../../utils/disponibilidade";
import { reservasApi } from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import "./ReservationModal.css";

const EMPTY_FORM = {
  data: toISODate(new Date()),
  hora_inicio: "",
  hora_fim: "",
  responsavel: "",
  setor: "",
  marcado_por: "",
  empresa: "GREEN",
  motivo: "",
};

// Atalhos de duração: preenchem o horário final, que continua editável
const DURACOES = [
  { minutos: 20, label: "20 min" },
  { minutos: 30, label: "30 min" },
  { minutos: 45, label: "45 min" },
  { minutos: 60, label: "1h" },
  { minutos: 90, label: "1h30" },
];

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toFormState(reserva) {
  const base = EMPTY_FORM;
  if (!reserva) return base;
  return {
    data: reserva.data || base.data,
    hora_inicio: (reserva.hora_inicio || "").slice(0, 5),
    hora_fim: (reserva.hora_fim || "").slice(0, 5),
    responsavel: reserva.responsavel || "",
    setor: reserva.setor || "",
    marcado_por: reserva.marcado_por || base.marcado_por,
    empresa: reserva.empresa || "GREEN",
    motivo: reserva.motivo || "",
  };
}

export default function ReservationModal({ open, mode = "create", reserva, onClose, onSubmit, submitting }) {
  const { usuario } = useAuth();
  const [form, setForm] = useState(() => toFormState(reserva));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(toFormState(reserva, mode));
      setErrors({});
      setFormError("");
    }
  }, [open, reserva, mode]);

  const [reservasDoDia, setReservasDoDia] = useState([]);
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    if (!open || !/^\d{4}-\d{2}-\d{2}$/.test(form.data)) {
      setReservasDoDia([]);
      return;
    }
    let ativo = true;
    reservasApi
      .listar({ data: form.data })
      .then((lista) => ativo && setReservasDoDia(Array.isArray(lista) ? lista : []))
      .catch(() => ativo && setReservasDoDia([]));
    return () => {
      ativo = false;
    };
  }, [open, form.data]);

  // Atualiza o "agora" enquanto o formulário está aberto (aviso de horário passado)
  useEffect(() => {
    if (!open) return;
    setAgora(new Date());
    const id = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(id);
  }, [open]);

  const original = useMemo(() => toFormState(reserva), [reserva]);

  const situacao = useMemo(
    () =>
      avaliarHorario(form, reservasDoDia, {
        ignorarId: mode === "edit" ? reserva?.id : null,
        // Na edição de uma reunião em andamento, só avisa se a data/início mudarem
        checarPassado:
          mode !== "edit" ||
          form.data !== original.data ||
          form.hora_inicio !== original.hora_inicio,
        agora,
      }),
    [form, reservasDoDia, mode, reserva, original, agora]
  );

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  const duracaoAtual =
    form.hora_inicio && form.hora_fim
      ? timeToMinutes(form.hora_fim) - timeToMinutes(form.hora_inicio)
      : null;

  function aplicarDuracao(minutos) {
    const fim = timeToMinutes(form.hora_inicio) + minutos;
    if (fim >= 24 * 60) return;
    setField("hora_fim", minutesToTime(fim));
  }

  function validate() {
    const next = {};
    if (!form.data) next.data = "Informe a data.";
    if (!form.hora_inicio) next.hora_inicio = "Informe o horário inicial.";
    if (!form.hora_fim) next.hora_fim = "Informe o horário final.";
    if (form.hora_inicio && form.hora_fim && form.hora_fim <= form.hora_inicio) {
      next.hora_fim = "O horário final deve ser maior que o inicial.";
    }
    if (!form.responsavel.trim()) next.responsavel = "Informe para quem é a reunião.";
    if (!form.setor.trim()) next.setor = "Informe o setor.";
    if (!form.empresa) next.empresa = "Selecione a empresa.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (submitting) return;
    if (!validate()) return;

    const payload = {
      data: form.data,
      hora_inicio: form.hora_inicio,
      hora_fim: form.hora_fim,
      responsavel: form.responsavel.trim(),
      setor: form.setor.trim(),
      marcado_por: form.marcado_por.trim(),
      empresa: form.empresa,
      motivo: form.motivo.trim() || undefined,
    };

    salvarUltimoColaborador(payload.marcado_por);

    const result = await onSubmit(payload);
    if (result && !result.ok && !result.handled) {
      setFormError(result.mensagem || "Não foi possível salvar a reserva.");
    }
  }

  return (
    <Modal open={open} onClose={onClose} width={520} title="Reserva de sala">
      <form className="gp-resform" onSubmit={handleSubmit} noValidate>
        <div className="gp-resform-header">
          <div className="gp-resform-icon">
            <CalendarDays size={20} />
          </div>
          <div>
            <h3 className="gp-resform-title">
              {mode === "edit" ? "Editar reserva" : "Nova reserva"}
            </h3>
            <p className="gp-resform-subtitle">Sala de reunião · Green Paperless</p>
          </div>
        </div>

        {formError && (
          <div className="gp-resform-alert">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        <div className="gp-resform-grid">
          <label className="gp-field">
            <span>Data</span>
            <input
              type="date"
              value={form.data}
              min={mode === "create" ? toISODate(new Date()) : undefined}
              onChange={(e) => setField("data", e.target.value)}
            />
            {errors.data && <em>{errors.data}</em>}
          </label>

          <label className="gp-field">
            <span>Empresa</span>
            <select value={form.empresa} onChange={(e) => setField("empresa", e.target.value)}>
              <option value="GREEN">Green</option>
              <option value="MV">MV</option>
              <option value="EXTERNO">Externo / Outros</option>
            </select>
            {errors.empresa && <em>{errors.empresa}</em>}
          </label>

          <label className="gp-field">
            <span>Horário inicial</span>
            <input
              type="time"
              value={form.hora_inicio}
              onChange={(e) => setField("hora_inicio", e.target.value)}
            />
            {errors.hora_inicio && <em>{errors.hora_inicio}</em>}
          </label>

          <label className="gp-field">
            <span>Horário final</span>
            <input
              type="time"
              value={form.hora_fim}
              min={form.hora_inicio || undefined}
              onChange={(e) => setField("hora_fim", e.target.value)}
            />
            {errors.hora_fim && <em>{errors.hora_fim}</em>}
          </label>

          <div className="gp-field gp-field-full">
            <span>Duração</span>
            <div className="gp-resform-duracoes">
              {DURACOES.map(({ minutos, label }) => (
                <button
                  key={minutos}
                  type="button"
                  className={`gp-btn gp-btn-ghost gp-btn-sm gp-resform-duracao ${
                    duracaoAtual === minutos ? "is-active" : ""
                  }`}
                  disabled={!form.hora_inicio}
                  onClick={() => aplicarDuracao(minutos)}
                >
                  {label}
                </button>
              ))}
            </div>
            {!form.hora_inicio && (
              <em className="gp-field-optional">Escolha o horário inicial para usar os atalhos.</em>
            )}
          </div>

          {situacao && (
            <div
              className={`gp-field-full gp-resform-check gp-resform-check-${situacao.tipo}`}
              role={situacao.tipo === "ok" ? "status" : "alert"}
            >
              {situacao.tipo === "ok" ? (
                <CircleCheck size={16} />
              ) : situacao.tipo === "aviso" ? (
                <AlertTriangle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <div>
                <strong>{situacao.titulo}</strong>
                {situacao.detalhe && <p>{situacao.detalhe}</p>}
                {situacao.conflitos.length > 0 && (
                  <ul>
                    {situacao.conflitos.map((r) => (
                      <li key={r.id}>{descreverConflito(r)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <label className="gp-field gp-field-full">
            <span>Marcado por (colaborador Green)</span>
            {/* O backend grava sempre o usuário logado */}
            <input type="text" value={usuario?.nome || ""} readOnly aria-readonly="true" />
            <em className="gp-field-optional">Preenchido com o usuário logado.</em>
          </label>

          <label className="gp-field">
            <span>Para quem (responsável)</span>
            <input
              type="text"
              placeholder="Nome de quem vai usar a sala"
              value={form.responsavel}
              onChange={(e) => setField("responsavel", e.target.value)}
            />
            {errors.responsavel && <em>{errors.responsavel}</em>}
          </label>

          <label className="gp-field">
            <span>Setor</span>
            <input
              type="text"
              placeholder="Ex.: Projetos, TI, Financeiro"
              value={form.setor}
              onChange={(e) => setField("setor", e.target.value)}
            />
            {errors.setor && <em>{errors.setor}</em>}
          </label>

          <label className="gp-field gp-field-full">
            <span>Motivo / Assunto <em className="gp-field-optional">(opcional)</em></span>
            <textarea
              rows={3}
              placeholder="Sobre o que é a reunião?"
              value={form.motivo}
              onChange={(e) => setField("motivo", e.target.value)}
            />
          </label>
        </div>

        <div className="gp-resform-actions">
          <button type="button" className="gp-btn gp-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="gp-btn gp-btn-primary" disabled={submitting}>
            {submitting ? "Salvando…" : mode === "edit" ? "Salvar alterações" : "Reservar sala"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
