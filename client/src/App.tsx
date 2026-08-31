import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.js";
import RequesterSelect from "./screens/RequesterSelect.js";
import CreateTicketForm from "./screens/CreateTicketForm.js";
import { RequesterProvider, useRequester } from "./lib/requesterContext.js";

// AC-02: /tickets, /tickets/new, /tickets/:id redirect here when nothing is
// selected.
function RequireRequester({ children }: { children: ReactNode }) {
  const { requester } = useRequester();
  if (!requester) {
    return <Navigate to="/select-requester" replace />;
  }
  return <>{children}</>;
}

function MyTicketsPlaceholder() {
  return <h1>My Tickets</h1>;
}

function TicketDetailPlaceholder() {
  return <h1>Ticket Detail</h1>;
}

function NotFoundPlaceholder() {
  return <h1>Not Found</h1>;
}

export default function App() {
  return (
    <RequesterProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/select-requester" element={<RequesterSelect />} />
          <Route
            path="/tickets"
            element={
              <RequireRequester>
                <AppShell>
                  <MyTicketsPlaceholder />
                </AppShell>
              </RequireRequester>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <RequireRequester>
                <AppShell>
                  <CreateTicketForm />
                </AppShell>
              </RequireRequester>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <RequireRequester>
                <AppShell>
                  <TicketDetailPlaceholder />
                </AppShell>
              </RequireRequester>
            }
          />
          <Route
            path="*"
            element={
              <AppShell>
                <NotFoundPlaceholder />
              </AppShell>
            }
          />
        </Routes>
      </BrowserRouter>
    </RequesterProvider>
  );
}
