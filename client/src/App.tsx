import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.js";
import Login from "./screens/Login.js";
import ChangePassword from "./screens/ChangePassword.js";
import CreateTicketForm from "./screens/CreateTicketForm.js";
import MyTickets from "./screens/MyTickets.js";
import TicketDetail from "./screens/TicketDetail.js";
import StaffTicketQueue from "./screens/StaffTicketQueue.js";
import StaffTicketDetail from "./screens/StaffTicketDetail.js";
import UserManagement from "./screens/UserManagement.js";
import { AuthProvider, useAuth } from "./lib/authContext.js";
import StateBanner from "./components/StateBanner.js";

// docs/lab-03/specification.md BR-02/FR-04 — every screen except Login and
// Change Password requires an authenticated session with the password
// change already done.
function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "loading") {
    return <StateBanner variant="loading">Loading…</StateBanner>;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  if (user!.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

// api-spec.md §4 — Administrator-only screen; a non-Administrator lands on
// the same forbidden treatment the API itself returns (403).
function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  if (status === "loading") {
    return <StateBanner variant="loading">Loading…</StateBanner>;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  if (user!.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (user!.role !== "ADMINISTRATOR") {
    return (
      <AppShell>
        <StateBanner variant="error">
          <p>You don't have access to this screen.</p>
        </StateBanner>
      </AppShell>
    );
  }
  return <>{children}</>;
}

function RequireAuthOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") {
    return <StateBanner variant="loading">Loading…</StateBanner>;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Login must redirect away from itself once a session already exists,
// rather than showing the form again.
function LoginRoute() {
  const { status, user } = useAuth();
  if (status === "authenticated") {
    return <Navigate to={user!.mustChangePassword ? "/change-password" : "/"} replace />;
  }
  return <Login />;
}

// FR-05 — role-specific home. Administrator also has nav access to the
// Ticket Queue (ui-spec.md §5.3), so both roles land there; User
// Management (Administrator's own screen) is a later phase, reached via
// its own future nav link rather than Home.
function Home() {
  const { user } = useAuth();
  if (user?.role === "REQUESTER") {
    return <Navigate to="/tickets" replace />;
  }
  if (user?.role === "IT_STAFF" || user?.role === "ADMINISTRATOR") {
    return <Navigate to="/staff/tickets" replace />;
  }
  return (
    <AppShell>
      <h1>Welcome, {user?.name}</h1>
      <p>Your screens are coming in a later phase of this sprint.</p>
    </AppShell>
  );
}

function NotFoundPlaceholder() {
  return <h1>Not Found</h1>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/change-password"
        element={
          <RequireAuthOnly>
            <ChangePassword />
          </RequireAuthOnly>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/tickets"
        element={
          <RequireAuth>
            <AppShell>
              <MyTickets />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/tickets/new"
        element={
          <RequireAuth>
            <AppShell>
              <CreateTicketForm />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/tickets/:id"
        element={
          <RequireAuth>
            <AppShell>
              <TicketDetail />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/staff/tickets"
        element={
          <RequireAuth>
            <AppShell>
              <StaffTicketQueue />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/staff/tickets/:id"
        element={
          <RequireAuth>
            <AppShell>
              <StaffTicketDetail />
            </AppShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireAdmin>
            <AppShell>
              <UserManagement />
            </AppShell>
          </RequireAdmin>
        }
      />
      <Route
        path="*"
        element={
          <RequireAuth>
            <AppShell>
              <NotFoundPlaceholder />
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
