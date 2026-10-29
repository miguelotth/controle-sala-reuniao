import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  CalendarCheck2,
  Clock3,
  Users2,
  Hourglass,
  CircleCheck,
  CircleDot,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Header from "../../components/Header/Header";
import ReservationCard from "../../components/ReservationCard/ReservationCard";
import ReservationModal from "../../components/ReservationModal/ReservationModal";
import ConflictModal from "../../components/ConflictModal/ConflictModal";
import ManagedReservationDetails from "../../components/ReservationDetailsModal/ManagedReservationDetails";
import EmptyState from "../../components/EmptyState/EmptyState";
import { useReservas } from "../../hooks/useReservas";
import { useReservationFlow } from "../../hooks/useReservationFlow";
import { useSettings } from "../../hooks/useSettings";
import {
  todayISO,
  formatTime,
  timeToMinutes,
  weekdayLong,
  formatDateBR,
  weekDates,
  endOfMonth,
  addDays,
  isReservationPast,
  formatDuracao,
} from "../../utils/date";
import { STATUS } from "../../utils/status";
import "./Dashboard.css";

function useNowMinutes() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  return now.getHours() * 60 + now.getMinutes();
}

function minutesToTime(minutes) {
  const normalized = Math.max(0, Math.min(24 * 60, minutes));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

const PERIODOS = [
  { id: "dia", label: "Hoje", vazio: "Nenhuma reserva para hoje" },
  { id: "semana", label: "Esta semana", vazio: "Nenhuma reserva no resto da semana" },
  { id: "mes", label: "Este mês", vazio: "Nenhuma reserva no resto do mês" },
];

function rotuloDia(data, hoje) {
  if (data === hoje) return "Hoje";
  if (data === addDays(hoje, 1)) return "Amanhã";
  return `${weekdayLong(data)}, ${formatDateBR(data)}`;
}

export default function Dashboard({ onOpenMobileMenu }) {
  const today = todayISO();
  const { settings } = useSettings();
  const { reservas, loading, refetch } = useReservas({ data: today });
  const nowMinutes = useNowMinutes();
  const [activePanel, setActivePanel] = useState(null);
  const [detailsReserva, setDetailsReserva] = useState(null);
  const [periodo, setPeriodo] = useState("dia");

  const fimPeriodo = periodo === "semana" ? weekDates(today)[6] : endOfMonth(today);
  const {
    reservas: reservasPeriodo,
    loading: loadingPeriodo,
    refetch: refetchPeriodo,
  } = useReservas({ data_inicio: today, data_fim: periodo === "dia" ? today : fimPeriodo });

  const flow = useReservationFlow({
    onChanged: () => {
      refetch();
      refetchPeriodo();
    },
  });

  const ativas = useMemo(
    () =>
      reservas
        .filter((r) => r.status !== STATUS.CANCELADA && r.status !== STATUS.CONFLITO)
        .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)),
    [reservas]
  );

  const emAndamento = useMemo(
    () =>
      ativas
        .filter((r) => r.status === STATUS.AGENDADA)
        .find(
          (r) =>
            timeToMinutes(r.hora_inicio) <= nowMinutes && nowMinutes < timeToMinutes(r.hora_fim)
        ),
    [ativas, nowMinutes]
  );

  const proximas = useMemo(
    () =>
      ativas
        .filter(
          (r) =>
            r.status === STATUS.AGENDADA &&
            timeToMinutes(r.hora_fim) > nowMinutes &&
            r !== emAndamento
        )
        .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)),
    [ativas, nowMinutes, emAndamento]
  );

  const standByReservas = useMemo(
    () =>
      ativas
        .filter((r) => r.status === STATUS.STAND_BY)
        .sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)),
    [ativas]
  );

  const standByCount = standByReservas.length;

  // Semana/mês: reservas ativas que ainda não terminaram, agrupadas por dia
  const gruposPeriodo = useMemo(() => {
    const agora = new Date();
    const grupos = new Map();

    reservasPeriodo
      .filter(
        (r) =>
          (r.status === STATUS.AGENDADA || r.status === STATUS.STAND_BY) &&
          !isReservationPast(r.data, r.hora_fim, agora)
      )
      .forEach((r) => {
        if (!grupos.has(r.data)) grupos.set(r.data, []);
        grupos.get(r.data).push(r);
      });

    return [...grupos.entries()].map(([data, lista]) => ({ data, reservas: lista }));
    // nowMinutes recalcula a lista quando o relógio avança
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservasPeriodo, nowMinutes]);

  const periodoAtual = PERIODOS.find((p) => p.id === periodo);

  const intervalosLivres = useMemo(() => {
    // O período que já passou não conta como horário livre
    const inicioExpediente = Math.max(timeToMinutes(settings.horaInicial), nowMinutes);
    const fimExpediente = timeToMinutes(settings.horaFinal);

    if (fimExpediente <= inicioExpediente) return [];

    const ocupados = ativas
      .filter((r) => r.status === STATUS.AGENDADA)
      .map((r) => ({
        inicio: Math.max(inicioExpediente, timeToMinutes(r.hora_inicio)),
        fim: Math.min(fimExpediente, timeToMinutes(r.hora_fim)),
      }))
      .filter((intervalo) => intervalo.fim > intervalo.inicio)
      .sort((a, b) => a.inicio - b.inicio);

    const consolidados = [];

    for (const intervalo of ocupados) {
      const ultimo = consolidados[consolidados.length - 1];

      if (!ultimo || intervalo.inicio > ultimo.fim) {
        consolidados.push({ ...intervalo });
      } else {
        ultimo.fim = Math.max(ultimo.fim, intervalo.fim);
      }
    }

    const livres = [];
    let cursor = inicioExpediente;

    for (const intervalo of consolidados) {
      if (intervalo.inicio > cursor) {
        livres.push({ inicio: cursor, fim: intervalo.inicio });
      }
      cursor = Math.max(cursor, intervalo.fim);
    }

    if (cursor < fimExpediente) {
      livres.push({ inicio: cursor, fim: fimExpediente });
    }

    return livres;
  }, [ativas, settings, nowMinutes]);

  const horariosLivres = useMemo(() => {
    const livresMin = intervalosLivres.reduce(
      (acc, intervalo) => acc + Math.max(0, intervalo.fim - intervalo.inicio),
      0
    );

    return formatDuracao(livresMin);
  }, [intervalosLivres]);

  function togglePanel(panel) {
    setActivePanel((current) => (current === panel ? null : panel));
  }

  function renderArrow(panel) {
    return activePanel === panel ? <ChevronUp size={15} /> : <ChevronDown size={15} />;
  }

  return (
    <div className="gp-page">
      <Header
        title="Dashboard"
        subtitle={`${weekdayLong(today)}, ${formatDateBR(today)}`}
        onOpenMobileMenu={onOpenMobileMenu}
      >
        <button className="gp-btn gp-btn-primary" onClick={() => flow.openCreate()}>
          <Plus size={16} /> Nova reserva
        </button>
      </Header>

      <section className={`gp-status-hero ${emAndamento ? "is-busy" : "is-free"}`}>
        <div className="gp-status-hero-icon">
          {emAndamento ? <CircleDot size={22} /> : <CircleCheck size={22} />}
        </div>
        <div className="gp-status-hero-text">
          <h2>
            {emAndamento
              ? `Sala ocupada até ${formatTime(emAndamento.hora_fim)}`
              : "Sala disponível"}
          </h2>
          {emAndamento ? (
            <div className="gp-status-hero-meta">
              <span>{emAndamento.responsavel}</span>
              <span>·</span>
              <span>{emAndamento.setor}</span>
              {emAndamento.motivo && (
                <>
                  <span>·</span>
                  <span>{emAndamento.motivo}</span>
                </>
              )}
              <span>·</span>
              <span>
                {formatTime(emAndamento.hora_inicio)} – {formatTime(emAndamento.hora_fim)}
              </span>
            </div>
          ) : (
            <p className="gp-status-hero-desc">Nenhuma reunião em andamento neste momento.</p>
          )}
        </div>
      </section>

      <section className="gp-summary-grid">
        <button
          type="button"
          className={`gp-summary-card gp-summary-card-clickable ${
            activePanel === "reservas" ? "is-open" : ""
          }`}
          onClick={() => togglePanel("reservas")}
          aria-expanded={activePanel === "reservas"}
        >
          <CalendarCheck2 size={18} />
          <div>
            <strong>{ativas.length}</strong>
            <span>Reservas hoje</span>
          </div>
          <span className="gp-summary-card-arrow">{renderArrow("reservas")}</span>
        </button>

        <button
          type="button"
          className={`gp-summary-card gp-summary-card-clickable ${
            activePanel === "proxima" ? "is-open" : ""
          }`}
          onClick={() => togglePanel("proxima")}
          aria-expanded={activePanel === "proxima"}
        >
          <Clock3 size={18} />
          <div>
            <strong>{proximas[0] ? formatTime(proximas[0].hora_inicio) : "—"}</strong>
            <span>Próxima reunião</span>
          </div>
          <span className="gp-summary-card-arrow">{renderArrow("proxima")}</span>
        </button>

        <button
          type="button"
          className={`gp-summary-card gp-summary-card-clickable ${
            activePanel === "livres" ? "is-open" : ""
          }`}
          onClick={() => togglePanel("livres")}
          aria-expanded={activePanel === "livres"}
        >
          <Hourglass size={18} />
          <div>
            <strong>{horariosLivres}</strong>
            <span>Livres hoje até {formatTime(settings.horaFinal)}</span>
          </div>
          <span className="gp-summary-card-arrow">{renderArrow("livres")}</span>
        </button>

        <button
          type="button"
          className={`gp-summary-card gp-summary-card-clickable gp-summary-card-standby ${
            activePanel === "standby" ? "is-open" : ""
          }`}
          onClick={() => togglePanel("standby")}
          aria-expanded={activePanel === "standby"}
        >
          <Users2 size={18} />
          <div>
            <strong>{standByCount}</strong>
            <span>Em stand by</span>
          </div>
          <span className="gp-summary-card-arrow">{renderArrow("standby")}</span>
        </button>
      </section>

      {activePanel === "reservas" && (
        <section className="gp-dashboard-detail-panel">
          <div className="gp-dashboard-detail-head">
            <div>
              <h3>Reservas de hoje</h3>
              <p>Todas as reservas válidas de {formatDateBR(today)}.</p>
            </div>
            <span>{ativas.length}</span>
          </div>

          {ativas.length === 0 ? (
            <p className="gp-dashboard-detail-empty">Nenhuma reserva registrada para hoje.</p>
          ) : (
            <div className="gp-rescard-list">
              {ativas.map((r) => (
                <ReservationCard key={r.id} reserva={r} onClick={setDetailsReserva} />
              ))}
            </div>
          )}
        </section>
      )}

      {activePanel === "proxima" && (
        <section className="gp-dashboard-detail-panel">
          <div className="gp-dashboard-detail-head">
            <div>
              <h3>Próxima reunião</h3>
              <p>
                {proximas[0]
                  ? `Começa em ${Math.max(
                      0,
                      timeToMinutes(proximas[0].hora_inicio) - nowMinutes
                    )} min.`
                  : "Não há outra reunião agendada para hoje."}
              </p>
            </div>
            {proximas[0] && <span>{formatTime(proximas[0].hora_inicio)}</span>}
          </div>

          {proximas[0] ? (
            <ReservationCard reserva={proximas[0]} onClick={setDetailsReserva} />
          ) : (
            <p className="gp-dashboard-detail-empty">A agenda restante do dia está livre.</p>
          )}
        </section>
      )}

      {activePanel === "livres" && (
        <section className="gp-dashboard-detail-panel">
          <div className="gp-dashboard-detail-head">
            <div>
              <h3>Horários livres</h3>
              <p>
                Período configurado: {formatTime(settings.horaInicial)} – {formatTime(settings.horaFinal)}, a partir de agora.
              </p>
            </div>
            <span>{horariosLivres}</span>
          </div>

          {intervalosLivres.length === 0 ? (
            <p className="gp-dashboard-detail-empty">Não há intervalos livres no período configurado.</p>
          ) : (
            <div className="gp-free-slots">
              {intervalosLivres.map((intervalo, index) => {
                const duracao = formatDuracao(intervalo.fim - intervalo.inicio);

                return (
                  <div className="gp-free-slot" key={`${intervalo.inicio}-${intervalo.fim}-${index}`}>
                    <Clock3 size={16} />
                    <div>
                      <strong>
                        {minutesToTime(intervalo.inicio)} – {minutesToTime(intervalo.fim)}
                      </strong>
                      <span>{duracao} disponíveis</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activePanel === "standby" && (
        <section className="gp-dashboard-detail-panel gp-dashboard-detail-panel-standby">
          <div className="gp-dashboard-detail-head">
            <div>
              <h3>Reuniões em stand by</h3>
              <p>Reservas pausadas temporariamente.</p>
            </div>
            <span>{standByCount}</span>
          </div>

          {standByReservas.length === 0 ? (
            <p className="gp-dashboard-detail-empty">Nenhuma reunião em stand by no momento.</p>
          ) : (
            <div className="gp-rescard-list">
              {standByReservas.map((r) => (
                <ReservationCard key={r.id} reserva={r} onClick={setDetailsReserva} />
              ))}
            </div>
          )}
        </section>
      )}

      <section className="gp-section">
        <div className="gp-section-head">
          <h3 className="gp-section-title gp-dashboard-list-title">Próximas reservas</h3>
          <div className="gp-tabs" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={periodo === p.id}
                className={`gp-tab ${periodo === p.id ? "is-active" : ""}`}
                onClick={() => setPeriodo(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {(periodo === "dia" ? loading : loadingPeriodo) ? (
          <div className="gp-skeleton-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="gp-skeleton-card" />
            ))}
          </div>
        ) : (periodo === "dia" ? proximas.length === 0 : gruposPeriodo.length === 0) ? (
          <EmptyState
            icon={CalendarCheck2}
            title={periodoAtual.vazio}
            description="A sala está livre durante todo o período."
            action={
              <button className="gp-btn gp-btn-primary gp-btn-sm" onClick={() => flow.openCreate()}>
                <Plus size={14} /> Criar reserva
              </button>
            }
          />
        ) : periodo === "dia" ? (
          <div className="gp-rescard-list">
            {proximas.map((r) => (
              <ReservationCard key={r.id} reserva={r} onClick={setDetailsReserva} />
            ))}
          </div>
        ) : (
          <div className="gp-dashboard-days">
            {gruposPeriodo.map((grupo) => (
              <div key={grupo.data} className="gp-dashboard-day">
                <h4 className="gp-dashboard-day-title">
                  {rotuloDia(grupo.data, today)}
                  <span>
                    {grupo.reservas.length} {grupo.reservas.length === 1 ? "reserva" : "reservas"}
                  </span>
                </h4>
                <div className="gp-rescard-list">
                  {grupo.reservas.map((r) => (
                    <ReservationCard key={r.id} reserva={r} onClick={setDetailsReserva} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ReservationModal
        open={flow.formState.open}
        mode={flow.formState.mode}
        reserva={flow.formState.reserva}
        submitting={flow.submitting}
        onClose={flow.closeForm}
        onSubmit={flow.submitForm}
      />
      <ManagedReservationDetails
        reserva={detailsReserva}
        onClose={() => setDetailsReserva(null)}
        flow={flow}
      />
      <ConflictModal
        conflict={flow.conflict}
        onClose={flow.closeConflict}
        onUsePriority={flow.usePriority}
        loading={flow.submitting}
      />
    </div>
  );
}
