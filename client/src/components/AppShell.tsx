import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useRequester } from "../lib/requesterContext.js";

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { requester, clearRequester } = useRequester();
  const navigate = useNavigate();

  // ui-spec.md §10 / UI-34: no confirmation step — this discards no server
  // data, only the client-side selection.
  function handleChangeRequester() {
    clearRequester();
    navigate("/select-requester");
  }

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

        <span className="app-shell__requester">{requester?.name ?? ""}</span>

        <button
          type="button"
          className="btn btn--secondary app-shell__change-requester-btn"
          onClick={handleChangeRequester}
        >
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
