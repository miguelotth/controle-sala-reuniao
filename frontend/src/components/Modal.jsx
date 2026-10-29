import { useEffect } from "react";
import { X } from "lucide-react";
import "./Modal.css";

/**
 * Em telas pequenas se comporta como drawer (entra pela base da tela).
 */
export default function Modal({ open, onClose, children, width = 520, title }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="gp-modal-overlay" onMouseDown={onClose}>
      <div
        className="gp-modal-panel gp-scrollbar"
        style={{ "--gp-modal-w": `${width}px` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="gp-modal-grabber" aria-hidden="true" />
        <button className="gp-modal-close" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}
