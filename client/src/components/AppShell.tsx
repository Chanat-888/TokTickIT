import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `app-shell__nav-link${isActive ? " app-shell__nav-link--active" : ""}`;

  return (
    <div className={`app-shell${mobileNavOpen ? " app-shell--nav-open" : ""}`}>
      <header className="app-shell__header">
        <span>TokTickIT</span>

        <nav className="app-shell__nav" aria-label="Primary">
          <NavLink to="/tickets" end className={navLinkClassName}>
            My Tickets
          </NavLink>
          <NavLink to="/tickets/new" className={navLinkClassName}>
            Create Ticket
          </NavLink>
        </nav>

        {/* Issue #17 replaces this placeholder with the real selected Requester. */}
        <span className="app-shell__requester">Requester Name</span>

        <button type="button" className="btn btn--secondary app-shell__change-requester-btn">
          Change Requester
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
