import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";
import Header from "../../components/Header/Header";
import ReservationModal from "../../components/ReservationModal/ReservationModal";
import ConflictModal from "../../components/ConflictModal/ConflictModal";
import ManagedReservationDetails from "../../components/ReservationDetailsModal/ManagedReservationDetails";
import AgendaDay from "./AgendaDay";
import AgendaWeek from "./AgendaWeek";
import { useReservas } from "../../hooks/useReservas";
import { useReservationFlow } from "../../hooks/useReservationFlow";
import { useSettings } from "../../hooks/useSettings";
import { reservasApi } from "../../services/api";
import {
  todayISO,
  addDays,
  weekDates,
  formatDateBR,
  weekdayLong,
  monthName,
  fromISODate,
  isTodayISO,
} from "../../utils/date";
import "./Agenda.css";

function useNowMinutes() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now.getHours() * 60 + now.getMinutes();
}

export default function Agenda({ onOpenMobileMenu }) {
  const [view, setView] = useState("hoje"); // "hoje" | "semana"
  const [detailsReserva, setDetailsReserva] = useState(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [weekAnchor, setWeekAnchor] = useState(todayISO());
  const { settings } = useSettings();
  const nowMinutes = useNowMinutes();

  const { reservas: dayReservas, loading: dayLoading, refetch: refetchDay } = useReservas({
    data: selectedDate,
  });

  const [weekData, setWeekData] = useState({});
  const [weekLoading, setWeekLoading] = useState(false);
  const dates = useMemo(() => weekDates(weekAnchor), [weekAnchor]);

  async function loadWeek() {
    setWeekLoading(true);
    try {
      const results = await Promise.all(
        dates.map((data) => reservasApi.listar({ data }).catch(() => []))
      );
      const map = {};
      dates.forEach((data, i) => {
        map[data] = Array.isArray(results[i]) ? results[i] : results[i]?.reservas || [];
      });
      setWeekData(map);
    } finally {
      setWeekLoading(false);
    }
  }

  useEffect(() => {
    if (view === "semana") loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, weekAnchor]);

  const refetchActive = () => {
    refetchDay();
    if (view === "semana") loadWeek();
  };

  const flow = useReservationFlow({ onChanged: refetchActive });

  const handleCreateOnDate = (date) => {
    setSelectedDate(date);
    flow.openCreate({ data: date });
  };

  return (
    <div className="gp-page">
      <Header title="Agenda" subtitle="Sala de reunião · Green Paperless" onOpenMobileMenu={onOpenMobileMenu}>
        <div className="gp-tabs">
          <button
            className={`gp-tab ${view === "hoje" ? "is-active" : ""}`}
            onClick={() => setView("hoje")}
          >
            Hoje
          </button>
          <button
            className={`gp-tab ${view === "semana" ? "is-active" : ""}`}
            onClick={() => setView("semana")}
          >
            Semana
          </button>
        </div>
        <button className="gp-btn gp-btn-primary" onClick={() => flow.openCreate({ data: selectedDate })}>
          <Plus size={16} /> Nova reserva
        </button>
      </Header>

      {view === "hoje" ? (
        <>
          <div className="gp-agenda-nav">
            <button
              className="gp-btn gp-btn-secondary gp-btn-sm"
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              aria-label="Dia anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="gp-agenda-nav-label">
              <CalendarDays size={15} />
              <span>
                {isTodayISO(selectedDate) ? "Hoje · " : ""}
                {weekdayLong(selectedDate)}, {formatDateBR(selectedDate)}
              </span>
            </div>
            <button
              className="gp-btn gp-btn-secondary gp-btn-sm"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              aria-label="Próximo dia"
            >
              <ChevronRight size={16} />
            </button>
            {!isTodayISO(selectedDate) && (
              <button className="gp-btn gp-btn-ghost gp-btn-sm" onClick={() => setSelectedDate(todayISO())}>
                Voltar para hoje
              </button>
            )}
          </div>

          <div className="gp-card gp-agenda-panel">
            {dayLoading ? (
              <div className="gp-skeleton-list">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="gp-skeleton-card" />
                ))}
              </div>
            ) : (
              <AgendaDay
                reservas={dayReservas}
                horaInicial={settings.horaInicial}
                horaFinal={settings.horaFinal}
                isToday={isTodayISO(selectedDate)}
                nowMinutes={nowMinutes}
                onSelect={setDetailsReserva}
              />
            )}
          </div>
        </>
      ) : (
        <>
          <div className="gp-agenda-nav">
            <button
              className="gp-btn gp-btn-secondary gp-btn-sm"
              onClick={() => setWeekAnchor((d) => addDays(d, -7))}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="gp-agenda-nav-label">
              <CalendarDays size={15} />
              <span>
                {monthName(dates[0])} {fromISODate(dates[0]).getFullYear()}
              </span>
            </div>
            <button
              className="gp-btn gp-btn-secondary gp-btn-sm"
              onClick={() => setWeekAnchor((d) => addDays(d, 7))}
              aria-label="Próxima semana"
            >
              <ChevronRight size={16} />
            </button>
            <button className="gp-btn gp-btn-ghost gp-btn-sm" onClick={() => setWeekAnchor(todayISO())}>
              Semana atual
            </button>
          </div>

          <div className="gp-card gp-agenda-panel gp-agenda-panel-week">
            {weekLoading ? (
              <div className="gp-skeleton-list">
                {[1, 2].map((i) => (
                  <div key={i} className="gp-skeleton-card" />
                ))}
              </div>
            ) : (
              <AgendaWeek
                dates={dates}
                reservasByDate={weekData}
                onSelect={setDetailsReserva}
                onCreateDay={handleCreateOnDate}
              />
            )}
          </div>
        </>
      )}

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
