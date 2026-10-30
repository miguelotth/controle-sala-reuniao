import { LogOut, Menu, UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "./Header.css";

export default function Header({ title, subtitle, onOpenMobileMenu, children }) {
  const { usuario, sair } = useAuth();

  return (
    <header className="gp-header">
      <div className="gp-header-left">
        <button
          className="gp-header-menu-btn"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="gp-header-title">{title}</h1>
          {subtitle && <p className="gp-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      <div className="gp-header-right">
        {children && <div className="gp-header-actions">{children}</div>}
        {usuario && (
          <div className="gp-header-user">
            <span className="gp-header-user-name" title={usuario.email || usuario.nome}>
              <UserRound size={15} />
              {usuario.nome}
            </span>
            <button type="button" className="gp-btn gp-btn-ghost gp-btn-sm" onClick={sair}>
              <LogOut size={15} />
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
