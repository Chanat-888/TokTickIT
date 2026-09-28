import { useEffect, useState } from "react";
import { getRequesterDashboard, type RequesterDashboard as DashboardData } from "../api.js";
import { useAuth } from "../lib/authContext.js";
import Badge from "../components/Badge.js";
import ListPanel from "../components/ListPanel.js";
import MetricCard from "../components/MetricCard.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "error";

// api-spec.md §3.1 — the same conditions the endpoint counted with.
const OPEN_QUERY = "status=NEW,OPEN,IN_PROGRESS,REOPENED";
const WAITING_QUERY = "status=WAITING_FOR_REQUESTER";

export default function RequesterDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  function load() {
    setLoadState("loading");
    getRequesterDashboard()
      .then((d) => {
        setData(d);
        setLoadState("loaded");
      })
      .catch(() => setLoadState("error"));
  }

  useEffect(load, []);

  const toRow = (t: DashboardData["recentlyUpdated"][number]) => ({
    key: t.id,
    to: `/tickets/${t.id}`,
    primary: t.summary,
    badge: <Badge kind="status" value={t.status} />,
    timestamp: t.updatedAt,
  });

  return (
    <div className="dashboard">
      <h1>Welcome back{user ? `, ${user.name}` : ""}</h1>

      {loadState === "loading" && (
        <div className="dashboard-grid dashboard-grid--loading" aria-busy="true">
          <StateBanner variant="loading">Loading your dashboard…</StateBanner>
        </div>
      )}

      {loadState === "error" && (
        <StateBanner variant="error">
          <p>We couldn't load your dashboard.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Try again
          </button>
        </StateBanner>
      )}

      {loadState === "loaded" && data && (
        <>
          <div className="dashboard-grid">
            <MetricCard label="My Open Tickets" value={data.myOpenTickets} to={`/tickets?${OPEN_QUERY}`} />
            <MetricCard
              label="Waiting for Requester"
              value={data.waitingForRequester}
              to={`/tickets?${WAITING_QUERY}`}
            />
          </div>

          <div className="dashboard-lists">
            <ListPanel
              title="Recently Updated"
              rows={data.recentlyUpdated.map(toRow)}
              emptyText="No recent activity yet."
            />
            <ListPanel
              title="Recently Resolved"
              rows={data.recentlyResolved.map(toRow)}
              emptyText="No resolved tickets yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
