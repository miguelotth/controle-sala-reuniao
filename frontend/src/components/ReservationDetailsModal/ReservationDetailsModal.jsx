import { useEffect, useState } from "react";

import {
  Pencil,
  Ban,
  CalendarDays,
  Clock3,
  User,
  Building2,
  MessageSquare,
  PauseCircle,
  PlayCircle,
  UserCheck,
  CircleStop,
  TimerReset
} from "lucide-react";

import Modal from "../Modal";
import AjusteHorario from "../AjusteHorario/AjusteHorario";

import {
  EmpresaBadge,
  StatusBadge
} from "../StatusBadge/StatusBadge";

import {
  formatDateBR,
  formatDateTimeBR,
  formatTime,
  isReservationPast,
  isTodayISO,
  timeToMinutes
} from "../../utils/date";

import { reservasApi } from "../../services/api";

import { STATUS } from "../../utils/status";

import "./ReservationDetailsModal.css";


export default function ReservationDetailsModal({
  reserva,
  onClose,
  onEdit,
  onCancel,
  onPause,
  onResume,
  onEnd,
  onExtend,
  changingStatus = false,
  readOnly = false
}) {
  const [estendendo, setEstendendo] = useState(false);
  const [novoFim, setNovoFim] = useState("");
  const [limite, setLimite] = useState(undefined);

  // Fecha o formulário de extensão ao trocar de reserva
  useEffect(() => {
    setEstendendo(false);
    setNovoFim("");
    setLimite(undefined);
  }, [reserva?.id]);

  /*
      Limite da extensão: início da próxima reserva agendada
      no mesmo dia. O backend confere de novo ao salvar.
  */
  useEffect(() => {
    if (!estendendo || !reserva) return;

    let ativo = true;

    reservasApi
      .listar({ data: reserva.data, status: STATUS.AGENDADA })
      .then((lista) => {
        if (!ativo) return;

        const fimAtual = timeToMinutes(reserva.hora_fim);

        const proxima = lista
          .filter(
            (r) =>
              r.id !== reserva.id &&
              timeToMinutes(r.hora_inicio) >= fimAtual
          )
          .sort(
            (a, b) =>
              timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
          )[0];

        setLimite(proxima ? formatTime(proxima.hora_inicio) : null);
      })
      .catch(() => ativo && setLimite(undefined));

    return () => {
      ativo = false;
    };
  }, [estendendo, reserva]);

  if (!reserva) return null;

  const podeGerenciar =
    !readOnly &&
    reserva.status !== STATUS.CANCELADA &&
    reserva.status !== STATUS.CONFLITO;

  const podePausar =
    podeGerenciar &&
    reserva.status === STATUS.AGENDADA;

  const podeRetomar =
    podeGerenciar &&
    reserva.status === STATUS.STAND_BY;

  const agora = new Date();

  const encerrada = isReservationPast(
    reserva.data,
    reserva.hora_fim,
    agora
  );

  const emAndamento =
    isTodayISO(reserva.data) &&
    timeToMinutes(reserva.hora_inicio) <
      agora.getHours() * 60 + agora.getMinutes() &&
    !encerrada;

  const podeEncerrar =
    podeGerenciar &&
    reserva.status === STATUS.AGENDADA &&
    emAndamento;

  const podeEstender =
    podeGerenciar &&
    reserva.status === STATUS.AGENDADA &&
    !encerrada;

  // Atalhos para atraso no fim: só os que cabem antes da próxima reserva
  const fimAtualMin = timeToMinutes(reserva.hora_fim);
  const limiteMin = limite ? timeToMinutes(limite) : 24 * 60 - 1;
  const atalhosExtensao = [15, 30, 60].map((minutos) => {
    const fim = fimAtualMin + minutos;
    const hh = String(Math.floor(fim / 60)).padStart(2, "0");
    const mm = String(fim % 60).padStart(2, "0");
    return {
      minutos,
      label: minutos === 60 ? "+1h" : `+${minutos} min`,
      hora: `${hh}:${mm}`,
      cabe: limite !== undefined && fim <= limiteMin,
    };
  });

  async function confirmarExtensao() {
    const sucesso = await onExtend?.(reserva, novoFim);

    if (sucesso) {
      setEstendendo(false);
      setNovoFim("");
    }
  }


  return (
    <Modal
      open={!!reserva}
      onClose={onClose}
      width={460}
      title="Detalhes da reserva"
    >
      <div className="gp-details">

        <div className="gp-details-header">

          <h3>
            {reserva.motivo ||
              "Reunião sem assunto definido"}
          </h3>

          <div className="gp-details-badges">

            <EmpresaBadge
              empresa={reserva.empresa}
            />

            <StatusBadge
              status={reserva.status}
            />

          </div>

        </div>


        <div className="gp-details-rows">

          <div className="gp-details-row">
            <CalendarDays size={16} />

            <span>
              {formatDateBR(reserva.data)}
            </span>
          </div>


          <div className="gp-details-row">
            <Clock3 size={16} />

            <span>
              {formatTime(
                reserva.hora_inicio
              )}{" "}
              –{" "}
              {formatTime(
                reserva.hora_fim
              )}

            </span>

            <AjusteHorario reserva={reserva} />
          </div>


          <div className="gp-details-row">
            <User size={16} />

            <span>
              {reserva.responsavel}
            </span>
          </div>


          <div className="gp-details-row">
            <Building2 size={16} />

            <span>
              {reserva.setor}
            </span>
          </div>


          {reserva.marcado_por && (
            <div className="gp-details-row">
              <UserCheck size={16} />

              <span>
                Marcado por {reserva.marcado_por}
              </span>
            </div>
          )}


          {reserva.cancelado_por && (
            <div className="gp-details-row">
              <Ban size={16} />

              <span>
                Cancelada por {reserva.cancelado_por}
                {reserva.cancelado_em && ` em ${formatDateTimeBR(reserva.cancelado_em)}`}
              </span>
            </div>
          )}


          {reserva.motivo && (
            <div className="gp-details-row">
              <MessageSquare size={16} />

              <span>
                {reserva.motivo}
              </span>
            </div>
          )}

        </div>


        {estendendo && (
          <div className="gp-details-extend">
            <div className="gp-details-extend-atalhos">
              {atalhosExtensao.map((a) => (
                <button
                  key={a.minutos}
                  type="button"
                  className={`gp-btn gp-btn-secondary gp-btn-sm ${
                    novoFim === a.hora ? "is-active" : ""
                  }`}
                  disabled={!a.cabe || changingStatus}
                  title={
                    a.cabe
                      ? `Terminar às ${a.hora}`
                      : "Passaria do início da próxima reserva"
                  }
                  onClick={() => setNovoFim(a.hora)}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <label className="gp-field">
              <span>Estender até</span>

              <input
                type="time"
                value={novoFim}
                min={formatTime(reserva.hora_fim)}
                max={limite || undefined}
                onChange={(e) =>
                  setNovoFim(e.target.value)
                }
              />
            </label>

            <p className="gp-details-extend-hint">
              {limite === undefined
                ? "Verificando a próxima reserva..."
                : limite && timeToMinutes(limite) <= fimAtualMin
                  ? `A próxima reserva começa às ${limite}, logo no fim desta. Não há horário livre para estender.`
                  : limite
                    ? `Próxima reserva às ${limite}. Dá para estender até esse horário.`
                    : "Nada marcado depois. A extensão está livre."}
            </p>

            <div className="gp-details-extend-actions">
              <button
                className="gp-btn gp-btn-secondary gp-btn-sm"
                onClick={() => setEstendendo(false)}
                disabled={changingStatus}
              >
                Voltar
              </button>

              <button
                className="gp-btn gp-btn-primary gp-btn-sm"
                onClick={confirmarExtensao}
                disabled={changingStatus || !novoFim}
              >
                {changingStatus
                  ? "Estendendo..."
                  : "Confirmar extensão"}
              </button>
            </div>
          </div>
        )}


        {podeGerenciar && !estendendo && (
          <div className="gp-details-actions">

            {podeEncerrar && (
              <button
                className="gp-btn gp-btn-standby"
                disabled={changingStatus}
                onClick={() =>
                  onEnd?.(reserva)
                }
              >
                <CircleStop size={16} />

                {changingStatus
                  ? "Encerrando..."
                  : "Encerrar agora"}
              </button>
            )}


            {podeEstender && onExtend && (
              <button
                className="gp-btn gp-btn-resume"
                disabled={changingStatus}
                onClick={() =>
                  setEstendendo(true)
                }
              >
                <TimerReset size={16} />
                Estender horário
              </button>
            )}


            {podePausar && (
              <button
                className="gp-btn gp-btn-standby"
                disabled={changingStatus}
                onClick={() =>
                  onPause?.(reserva)
                }
              >
                <PauseCircle size={16} />

                {changingStatus
                  ? "Pausando..."
                  : "Pausar reunião"}
              </button>
            )}


            {podeRetomar && (
              <button
                className="gp-btn gp-btn-resume"
                disabled={changingStatus}
                onClick={() =>
                  onResume?.(reserva)
                }
              >
                <PlayCircle size={16} />

                {changingStatus
                  ? "Retomando..."
                  : "Retomar reunião"}
              </button>
            )}


            <button
              className="gp-btn gp-btn-secondary"
              onClick={() =>
                onEdit(reserva)
              }
            >
              <Pencil size={15} />
              Editar reserva
            </button>


            <button
              className="gp-btn gp-btn-danger"
              onClick={() =>
                onCancel(reserva)
              }
            >
              <Ban size={15} />
              Cancelar reserva
            </button>

          </div>
        )}

      </div>
    </Modal>
  );
}