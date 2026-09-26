import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStaffDashboard, type Role, type StaffDashboard as DashboardData, type TicketStatus } from "../api.js";
import { useAuth } from "../lib/authContext.js";
import Badge from "../components/Badge.js";
import ListPanel from "../components/ListPanel.js";
import MetricCard from "../components/MetricCard.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "error" | "forbidden";

const STATUS_ORDER: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];

const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  WAITING_FOR_REQUESTER: "Waiting for Requester",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  CANCELLED: "Cancelled",
};

const ROLE_ORDER: { role: Role; label: string }[] = [
  { role: "REQUESTER", label: "Requester" },
  { role: "IT_STAFF", label: "IT Staff" },
  { role: "ADMINISTRATOR", label: "Administrator" },
];

// api-spec.md §3.1 — every status except Closed/Cancelled (BR-21).
const ACTIVE_STATUSES = "NEW,OPEN,IN_PROGRESS,WAITING_FOR_REQUESTER,RESOLVED,REOPENED";

export default function StaffDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  function load() {
    setLoadState("loading");
    getStaffDashboard()
      .then((d) => {
        setData(d);
        setLoadState("loaded");
      })
      .catch((err: unknown) => {
        const status = err instanceof Error ? Number(err.message.match(/status (\d+)/)?.[1]) : undefined;
        setLoadState(status === 403 ? "forbidden" : "error");
      });
  }

  useEffect(load, []);

  return (
    <div className="dashboard">
      <h1>Welcome back{user ? `, ${user.name}` : ""}</h1>

      {loadState === "loading" && (
        <div className="dashboard-grid dashboard-grid--loading" aria-busy="true">
          <StateBanner variant="loading">Loading your dashboard…</StateBanner>
        </div>
      )}

      {loadState === "forbidden" && (
        <StateBanner variant="error">
          <p>You don't have access to the dashboard.</p>
        </StateBanner>
      )}

      {loadState === "error" && (
        <StateBanner variant="error">
          <p>We couldn't load your dashboard.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Try again
          </button>
        </StateBanner>
      )}

      {loadState === "loaded" && data && user && (
        <>
          <div className="dashboard-grid">
            <MetricCard
              label="Unassigned"
              value={data.unassigned}
              to={`/staff/tickets?ownerId=unassigned&status=${ACTIVE_STATUSES}`}
            />
            <MetricCard
              label="My Assigned"
              value={data.myAssigned}
              to={`/staff/tickets?ownerId=${user.id}&status=${ACTIVE_STATUSES}`}
            />
            <MetricCard label="By Status">
              <ul className="status-breakdown">
                {STATUS_ORDER.map((s) => (
                  <li key={s}>
                    <Link
                      className="status-breakdown__chip"
                      to={`/staff/tickets?status=${s}`}
                      aria-label={`${STATUS_LABEL[s]}: ${data.byStatus[s]}`}
                    >
                      <span>{STATUS_LABEL[s]}</span>
                      <strong>{data.byStatus[s]}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            </MetricCard>
            {data.accounts && (
              <MetricCard label="Accounts">
                <ul className="status-breakdown">
                  {ROLE_ORDER.map(({ role, label }) => (
                    <li key={role}>
                      <Link
                        className="status-breakdown__chip"
                        to={`/admin/users?role=${role}`}
                        aria-label={`${label}: ${data.accounts![role]}`}
                      >
                        <span>{label}</span>
                        <strong>{data.accounts![role]}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              </MetricCard>
            )}
          </div>

          <div className="dashboard-lists">
            <ListPanel
              title="Recently Updated"
              rows={data.recentlyUpdated.map((t) => ({
                key: t.id,
                to: `/staff/tickets/${t.id}`,
                primary: t.summary,
                badge: <Badge kind="status" value={t.status} />,
                timestamp: t.updatedAt,
              }))}
              emptyText="No recent activity yet."
            />
            <ListPanel
              title="My Recent Actions Taken"
              rows={data.myRecentActionsTaken.map((a) => ({
                key: a.id,
                to: `/staff/tickets/${a.ticketId}`,
                primary: `${a.ticketNumber} — ${a.description}`,
                timestamp: a.createdAt,
              }))}
              emptyText="No actions recorded yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
