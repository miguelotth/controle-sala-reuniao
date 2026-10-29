import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { EmpresaBadge, StatusBadge } from "../../components/StatusBadge/StatusBadge";
import { formatTime, timeToMinutes } from "../../utils/date";
import { STATUS } from "../../utils/status";

const ROW_HEIGHT = 96; // px por hora

// Abaixo disso o bloco mostra só uma linha (horário, título e etiquetas)
const MIN_MINUTOS_DETALHADO = 45;

function layoutDay(reservas) {
  const sorted = [...reservas].sort(
    (a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
  );
  const clusters = [];
  let current = [];
  let currentEnd = -1;
  for (const r of sorted) {
    const start = timeToMinutes(r.hora_inicio);
    if (current.length && start >= currentEnd) {
      clusters.push(current);
      current = [];
      currentEnd = -1;
    }
    current.push(r);
    currentEnd = Math.max(currentEnd, timeToMinutes(r.hora_fim));
  }
  if (current.length) clusters.push(current);

  const layout = [];
  clusters.forEach((cluster) => {
    cluster.forEach((r, i) => layout.push({ reserva: r, col: i, colCount: cluster.length }));
  });
  return layout;
}

export default function AgendaDay({ reservas, horaInicial, horaFinal, isToday, nowMinutes, onSelect }) {
  const dayStart = timeToMinutes(horaInicial);
  const dayEnd = timeToMinutes(horaFinal);
  const totalMinutes = Math.max(60, dayEnd - dayStart);
  const pxPerMin = ROW_HEIGHT / 60;
  const trackHeight = totalMinutes * pxPerMin;

  const hours = useMemo(() => {
    const list = [];
    for (let m = dayStart; m <= dayEnd; m += 60) list.push(m);
    return list;
  }, [dayStart, dayEnd]);

  const ativas = useMemo(
    () => reservas.filter((r) => r.status !== STATUS.CANCELADA && r.status !== STATUS.CONFLITO),
    [reservas]
  );
  const blocks = useMemo(() => layoutDay(ativas), [ativas]);

  const nowOffset =
    isToday && nowMinutes >= dayStart && nowMinutes <= dayEnd
      ? (nowMinutes - dayStart) * pxPerMin
      : null;

  return (
    <div className="gp-timeline">
      <div className="gp-timeline-hours">
        {hours.map((m) => (
          <div key={m} className="gp-timeline-hour" style={{ height: ROW_HEIGHT }}>
            {String(Math.floor(m / 60)).padStart(2, "0")}:00
          </div>
        ))}
      </div>

      <div className="gp-timeline-track" style={{ height: trackHeight }}>
        {hours.map((m) => (
          <div
            key={m}
            className="gp-timeline-gridline"
            style={{ top: (m - dayStart) * pxPerMin }}
          />
        ))}

        {ativas.length === 0 && (
          <div className="gp-timeline-empty">
            <CalendarClock size={16} />
            Sala livre durante todo o período
          </div>
        )}

        {nowOffset !== null && (
          <div className="gp-timeline-now" style={{ top: nowOffset }}>
            <span className="gp-timeline-now-dot" />
          </div>
        )}

        {blocks.map(({ reserva, col, colCount }) => {
          const start = Math.max(dayStart, timeToMinutes(reserva.hora_inicio));
          const end = Math.min(dayEnd, timeToMinutes(reserva.hora_fim));
          const top = (start - dayStart) * pxPerMin;
          // 2px de folga para blocos encostados não se sobreporem
          const height = Math.max(36, (end - start) * pxPerMin - 2);
          const width = `calc(${100 / colCount}% - 6px)`;
          const left = `calc(${(100 / colCount) * col}% + 3px)`;
          const compacto = end - start < MIN_MINUTOS_DETALHADO;

          return (
            <button
              key={reserva.id}
              className={`gp-timeline-block gp-timeline-block-${reserva.status.toLowerCase()} ${
                compacto ? "is-compact" : ""
              }`}
              style={{ top, height, width, left }}
              onClick={() => onSelect(reserva)}
              title={`${formatTime(reserva.hora_inicio)} – ${formatTime(reserva.hora_fim)} · ${
                reserva.motivo || reserva.responsavel
              }`}
              type="button"
            >
              <div className="gp-timeline-block-head">
                <span className="gp-timeline-block-time">
                  {formatTime(reserva.hora_inicio)} – {formatTime(reserva.hora_fim)}
                </span>
                <span className="gp-timeline-block-title">
                  {reserva.motivo || reserva.responsavel}
                </span>
                <span className="gp-timeline-block-tags">
                  <EmpresaBadge empresa={reserva.empresa} size="sm" />
                  <StatusBadge status={reserva.status} size="sm" />
                </span>
              </div>
              {!compacto && (
                <div className="gp-timeline-block-meta">
                  {reserva.responsavel} · {reserva.setor}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
