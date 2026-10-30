import { useEffect, useMemo, useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import Header from "../../components/Header/Header";
import { StatusBadge, EmpresaBadge } from "../../components/StatusBadge/StatusBadge";
import EmptyState from "../../components/EmptyState/EmptyState";
import ReservationDetailsModal from "../../components/ReservationDetailsModal/ReservationDetailsModal";
import { useReservas } from "../../hooks/useReservas";
import { useIsMobile } from "../../hooks/useMediaQuery";
import AjusteHorario from "../../components/AjusteHorario/AjusteHorario";
import { formatDateBR, formatDateTimeBR, formatTime, isReservationPast, ajusteDeHorario } from "../../utils/date";
import { STATUS } from "../../utils/status";
import "../Reservas/Reservas.css";

export default function Historico({ onOpenMobileMenu }) {
  const [filters, setFilters] = useState({ data: "", tipo: "" }); // tipo: "" | PASSADAS | ESTENDIDAS | CANCELADA | CONFLITO
  const [detailsReserva, setDetailsReserva] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const isMobile = useIsMobile();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const { reservas, loading } = useReservas({ data: filters.data || undefined });

  const historico = useMemo(() => {
    const base = reservas
      .filter(
        (r) =>
          isReservationPast(r.data, r.hora_fim, now) ||
          r.status === STATUS.CANCELADA ||
          r.status === STATUS.CONFLITO
      )
      .sort((a, b) => {
        const porData = b.data.localeCompare(a.data);
        if (porData !== 0) return porData;
        return b.hora_inicio.localeCompare(a.hora_inicio);
      });

    if (!filters.tipo) return base;

    if (filters.tipo === "PASSADAS") {
      return base.filter((r) => isReservationPast(r.data, r.hora_fim, now));
    }

    if (filters.tipo === "ESTENDIDAS") {
      return base.filter((r) => ajusteDeHorario(r)?.tipo === "estendida");
    }

    return base.filter((r) => r.status === filters.tipo);
  }, [reservas, filters.tipo, now]);

  return (
    <div className="gp-page">
      <Header
        title="Histórico"
        subtitle="Reservas passadas, canceladas ou em conflito"
        onOpenMobileMenu={onOpenMobileMenu}
      />

      <div className="gp-filters">
        <input
          type="date"
          value={filters.data}
          onChange={(e) => setFilters((f) => ({ ...f, data: e.target.value }))}
        />
        <select
          value={filters.tipo}
          onChange={(e) => setFilters((f) => ({ ...f, tipo: e.target.value }))}
        >
          <option value="">Todo o histórico</option>
          <option value="PASSADAS">Somente passadas</option>
          <option value="ESTENDIDAS">Somente com horário estendido</option>
          <option value="CANCELADA">Somente canceladas</option>
          <option value="CONFLITO">Somente conflitos</option>
        </select>
      </div>

      {loading ? (
        <div className="gp-skeleton-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="gp-skeleton-card" />
          ))}
        </div>
      ) : historico.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Nada por aqui ainda"
          description="Reservas encerradas, canceladas ou com conflito aparecerão neste histórico."
        />
      ) : isMobile ? (
        <div className="gp-reservas-cards">
          {historico.map((r) => (
            <button
              key={r.id}
              className="gp-reservas-card"
              style={{ textAlign: "left", width: "100%", cursor: "pointer" }}
              onClick={() => setDetailsReserva(r)}
            >
              <div className="gp-reservas-card-top">
                <span className="gp-reservas-card-date">
                  {formatDateBR(r.data)} · {formatTime(r.hora_inicio)}–{formatTime(r.hora_fim)}
                </span>
                <StatusBadge status={r.status} size="sm" />
              </div>
              <p className="gp-reservas-card-title">{r.motivo || r.responsavel}</p>
              <p className="gp-reservas-card-meta">
                {r.responsavel} · {r.setor}
                {r.marcado_por && ` · marcado por ${r.marcado_por}`}
                {r.cancelado_por && ` · cancelado por ${r.cancelado_por}`}
              </p>
              <div className="gp-reservas-card-bottom">
                <EmpresaBadge empresa={r.empresa} size="sm" />
                <AjusteHorario reserva={r} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="gp-table-wrap gp-card">
          <table className="gp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Responsável</th>
                <th>Setor</th>
                <th>Marcado por</th>
                <th>Empresa</th>
                <th>Motivo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((r) => (
                <tr key={r.id} onClick={() => setDetailsReserva(r)} style={{ cursor: "pointer" }}>
                  <td>{formatDateBR(r.data)}</td>
                  <td>
                    <div className="gp-table-horario">
                      {formatTime(r.hora_inicio)}–{formatTime(r.hora_fim)}
                      <AjusteHorario reserva={r} />
                    </div>
                  </td>
                  <td>{r.responsavel}</td>
                  <td>{r.setor}</td>
                  <td>{r.marcado_por || "—"}</td>
                  <td>
                    <EmpresaBadge empresa={r.empresa} size="sm" />
                  </td>
                  <td className="gp-table-motivo">{r.motivo || "—"}</td>
                  <td>
                    <div className="gp-table-horario">
                      <StatusBadge status={r.status} size="sm" />
                      {r.cancelado_por && (
                        <span className="gp-table-cancelado" title={formatDateTimeBR(r.cancelado_em)}>
                          por {r.cancelado_por}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReservationDetailsModal
        reserva={detailsReserva}
        onClose={() => setDetailsReserva(null)}
        readOnly
      />
    </div>
  );
}
