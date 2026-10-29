import "./EmptyState.css";

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="gp-empty">
      {Icon && (
        <div className="gp-empty-icon">
          <Icon size={26} strokeWidth={1.6} />
        </div>
      )}
      <h3 className="gp-empty-title">{title}</h3>
      {description && <p className="gp-empty-desc">{description}</p>}
      {action && <div className="gp-empty-action">{action}</div>}
    </div>
  );
}
