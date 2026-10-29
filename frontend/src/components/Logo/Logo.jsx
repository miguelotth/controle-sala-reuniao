import "./Logo.css";

/** Logo da marca. `variant="reduced"` mostra só o "g" (sidebar recolhida). */
export default function Logo({ variant = "full", tone = "auto", className = "" }) {
  if (variant === "reduced") {
    return (
      <span className={`gp-logo gp-logo-reduced gp-logo-${tone} ${className}`} aria-label="Green Paperless">
        <span className="gp-logo-g">g</span>
        <span className="gp-logo-dot" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={`gp-logo gp-logo-full gp-logo-${tone} ${className}`} aria-label="Green Paperless">
      <span className="gp-logo-word">
        green<span className="gp-logo-dot" aria-hidden="true" />
      </span>
      <span className="gp-logo-sub">PAPERLESS</span>
    </span>
  );
}
