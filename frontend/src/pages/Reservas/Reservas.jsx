import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Eye, Pencil, Ban, ListChecks } from "lucide-react";
import Header from "../../components/Header/Header";
import { StatusBadge, EmpresaBadge } from "../../components/StatusBadge/StatusBadge";
import EmptyState from "../../components/EmptyState/EmptyState";
import ReservationModal from "../../components/ReservationModal/ReservationModal";
import ConflictModal from "../../components/ConflictModal/ConflictModal";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import ReservationDetailsModal from "../../components/ReservationDetailsModal/ReservationDetailsModal";
import AjusteHorario from "../../components/AjusteHorario/AjusteHorario";
import { useReservas } from "../../hooks/useReservas";
import { useReservationFlow } from "../../hooks/useReservationFlow";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { formatDateBR, formatTime, isReservationPast } from "../../utils/date";
import { STATUS } from "../../utils/status";
import "./Reservas.css";

export default function Reservas({ onOpenMobileMenu }) {
  const [filters, setFilters] = useState({ data: "", empresa: "", status: "" });
  const [search, setSearch] = useState("");
  const [detailsReserva, setDetailsReserva] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const isMobile = useIsMobile();

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const apiFilters = useMemo(
    () => ({
      data: filters.data || undefined,
      empresa: filters.empresa || undefined,
      status: filters.status || undefined,
    }),
    [filters]
  );
  const { reservas, loading, refetch } = useReservas(apiFilters);

  const flow = useReservationFlow({ onChanged: refetch });

  const filtradas = useMemo(() => {
    const term = search.trim().toLowerCase();

    const ativas = reservas.filter(
      (r) =>
        (r.status === STATUS.AGENDADA || r.status === STATUS.STAND_BY) &&
        !isReservationPast(r.data, r.hora_fim, now)
    );

    if (!term) return ativas;

    return ativas.filter(
      (r) =>
        r.responsavel?.toLowerCase().includes(term) ||
        r.setor?.toLowerCase().includes(term) ||
        r.marcado_por?.toLowerCase().includes(term)
    );
  }, [reservas, search, now]);

  function handleEdit(reserva) {
    setDetailsReserva(null);
    flow.openEdit(reserva);
  }
  function handleCancel(reserva) {
    setDetailsReserva(null);
    flow.openCancelConfirm(reserva);
  }

  async function handlePause(reserva) {
      const sucesso = await flow.pauseReservation(reserva);

      if (sucesso) {
          setDetailsReserva(null);
      }
  }

  async function handleEnd(reserva) {
      const sucesso = await flow.endReservation(reserva);

      if (sucesso) {
          setDetailsReserva(null);
      }
  }

  async function handleExtend(reserva, horaFim) {
      const sucesso = await flow.extendReservation(reserva, horaFim);

      if (sucesso) {
          setDetailsReserva(null);
      }

      return sucesso;
  }

  async function handleResume(reserva) {
      const sucesso = await flow.resumeReservation(reserva);

      if (sucesso) {
          setDetailsReserva(null);
      }
  }

  return (
    <div className="gp-page">
      <Header title="Reservas" subtitle="Reservas ativas da sala" onOpenMobileMenu={onOpenMobileMenu}>
        <button className="gp-btn gp-btn-primary" onClick={() => flow.openCreate()}>
          <Plus size={16} /> Nova reserva
        </button>
      </Header>

      <div className="gp-filters">
        <div className="gp-filters-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Buscar por responsável, setor ou quem marcou"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <input
          type="date"
          value={filters.data}
          onChange={(e) => setFilters((f) => ({ ...f, data: e.target.value }))}
        />
        <select
          value={filters.empresa}
          onChange={(e) => setFilters((f) => ({ ...f, empresa: e.target.value }))}
        >
          <option value="">Todas as empresas</option>
          <option value="GREEN">Green</option>
          <option value="MV">MV</option>
          <option value="EXTERNO">Externo</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
        >
          <option value="">Todos os status ativos</option>
          <option value="AGENDADA">Agendada</option>
          <option value="STAND_BY">Stand by</option>
        </select>
      </div>

      {loading ? (
        <div className="gp-skeleton-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="gp-skeleton-card" />
          ))}
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nenhuma reserva encontrada"
          description="Não há reservas ativas com esses filtros. Ajuste a busca ou crie uma nova reserva."
          action={
            <button className="gp-btn gp-btn-primary gp-btn-sm" onClick={() => flow.openCreate()}>
              <Plus size={14} /> Criar reserva
            </button>
          }
        />
      ) : isMobile ? (
        <div className="gp-reservas-cards">
          {filtradas.map((r) => (
            <div key={r.id} className="gp-reservas-card">
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
              </p>
              <AjusteHorario reserva={r} />
              <div className="gp-reservas-card-bottom">
                <EmpresaBadge empresa={r.empresa} size="sm" />
                <div className="gp-reservas-card-actions">
                  <button className="gp-icon-btn" onClick={() => setDetailsReserva(r)} aria-label="Ver detalhes">
                    <Eye size={15} />
                  </button>
                  {r.status !== STATUS.CANCELADA && (
                    <>
                      <button className="gp-icon-btn" onClick={() => flow.openEdit(r)} aria-label="Editar">
                        <Pencil size={15} />
                      </button>
                      <button
                        className="gp-icon-btn gp-icon-btn-danger"
                        onClick={() => flow.openCancelConfirm(r)}
                        aria-label="Cancelar"
                      >
                        <Ban size={15} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateBR(r.data)}</td>
                  <td>
                    <div className="gp-table-horario">
                      {formatTime(r.hora_inicio)}–{formatTime(r.hora_fim)}
                      <AjusteHorario reserva={r} mostrarPrevisto={false} />
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
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td>
                    <div className="gp-reservas-card-actions">
                      <button className="gp-icon-btn" onClick={() => setDetailsReserva(r)} aria-label="Ver detalhes">
                        <Eye size={15} />
                      </button>
                      {r.status !== STATUS.CANCELADA && (
                        <>
                          <button className="gp-icon-btn" onClick={() => flow.openEdit(r)} aria-label="Editar">
                            <Pencil size={15} />
                          </button>
                          <button
                            className="gp-icon-btn gp-icon-btn-danger"
                            onClick={() => flow.openCancelConfirm(r)}
                            aria-label="Cancelar"
                          >
                            <Ban size={15} />
                          </button>
                        </>
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
            onEdit={handleEdit}
            onCancel={handleCancel}
            onPause={handlePause}
            onResume={handleResume}
            onEnd={handleEnd}
            onExtend={handleExtend}
            changingStatus={flow.changingStatus}
        />

      <ReservationModal
        open={flow.formState.open}
        mode={flow.formState.mode}
        reserva={flow.formState.reserva}
        submitting={flow.submitting}
        onClose={flow.closeForm}
        onSubmit={flow.submitForm}
      />
      <ConflictModal
        conflict={flow.conflict}
        onClose={flow.closeConflict}
        onUsePriority={flow.usePriority}
        loading={flow.submitting}
      />
      <ConfirmModal
        open={!!flow.cancelTarget}
        title="Cancelar reserva?"
        description="A reserva sairá da agenda ativa, mas permanecerá disponível no histórico."
        confirmLabel="Cancelar reserva"
        cancelLabel="Voltar"
        danger
        loading={flow.cancelling}
        onConfirm={flow.confirmCancel}
        onClose={flow.closeCancelConfirm}
      />
    </div>
  );
}
