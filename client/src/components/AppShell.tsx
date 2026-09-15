import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext.js";

interface AppShellProps {
  children: ReactNode;
}

const ROLE_LABEL: Record<string, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`;

  return (
    <div className={`app-shell${mobileNavOpen ? " app-shell--nav-open" : ""}`}>
      <header className="app-shell__header">
        <span>TokTickIT</span>

        <nav className="app-shell__nav" aria-label="Primary">
          {user?.role === "REQUESTER" && (
            <>
              <NavLink to="/tickets" end className={navLinkClassName}>
                My Tickets
              </NavLink>
              <NavLink to="/tickets/new" className={navLinkClassName}>
                Create Ticket
              </NavLink>
            </>
          )}
        </nav>

        <span className="app-shell__requester">{user?.name ?? ""}</span>
        {user && <span className="role-badge">{ROLE_LABEL[user.role]}</span>}

        <button
          type="button"
          className="btn btn--secondary app-shell__change-requester-btn"
          onClick={handleLogout}
        >
          Logout
        </button>

        <button
          type="button"
          className="app-shell__mobile-toggle"
          aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          title={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          ☰
        </button>
      </header>

      <main>{children}</main>
    </div>
  );
}
