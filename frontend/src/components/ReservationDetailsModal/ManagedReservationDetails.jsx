import ReservationDetailsModal from "./ReservationDetailsModal";
import ConfirmModal from "../ConfirmModal/ConfirmModal";

/**
 * Detalhes da reserva já ligados ao fluxo de ações
 * (editar, cancelar, pausar, retomar, encerrar e estender).
 * Usado nas páginas que não montam esse fluxo por conta própria.
 */
export default function ManagedReservationDetails({ reserva, onClose, flow }) {
  async function executar(acao, ...args) {
    const sucesso = await acao(...args);
    if (sucesso) onClose();
    return sucesso;
  }

  return (
    <>
      <ReservationDetailsModal
        reserva={reserva}
        onClose={onClose}
        onEdit={(r) => {
          onClose();
          flow.openEdit(r);
        }}
        onCancel={(r) => {
          onClose();
          flow.openCancelConfirm(r);
        }}
        onPause={(r) => executar(flow.pauseReservation, r)}
        onResume={(r) => executar(flow.resumeReservation, r)}
        onEnd={(r) => executar(flow.endReservation, r)}
        onExtend={(r, horaFim) => executar(flow.extendReservation, r, horaFim)}
        changingStatus={flow.changingStatus}
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
    </>
  );
}
