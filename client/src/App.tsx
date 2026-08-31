import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.js";

function SelectRequesterPlaceholder() {
  return <h1>Select Requester</h1>;
}

function MyTicketsPlaceholder() {
  return <h1>My Tickets</h1>;
}

function CreateTicketPlaceholder() {
  return <h1>Create Ticket</h1>;
}

function TicketDetailPlaceholder() {
  return <h1>Ticket Detail</h1>;
}

function NotFoundPlaceholder() {
  return <h1>Not Found</h1>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tickets" replace />} />
        <Route path="/select-requester" element={<SelectRequesterPlaceholder />} />
        <Route
          path="/tickets"
          element={
            <AppShell>
              <MyTicketsPlaceholder />
            </AppShell>
          }
        />
        <Route
          path="/tickets/new"
          element={
            <AppShell>
              <CreateTicketPlaceholder />
            </AppShell>
          }
        />
        <Route
          path="/tickets/:id"
          element={
            <AppShell>
              <TicketDetailPlaceholder />
            </AppShell>
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
  );
}
