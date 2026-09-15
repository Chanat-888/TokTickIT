import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAssignableUsers,
  getCategories,
  getStaffTickets,
  type AssignableUser,
  type Category,
  type StaffTicket,
  type StaffTicketListParams,
  type StaffTicketListResult,
  type TicketStatus,
} from "../api.js";
import { useAuth } from "../lib/authContext.js";
import { defaultSortDir, type SortableTicketField } from "../lib/sortDefaults.js";
import Badge from "../components/Badge.js";
import Pagination from "../components/Pagination.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "error" | "forbidden";
type OwnerFilter = "" | "mine" | "unassigned";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "WAITING_FOR_REQUESTER", label: "Waiting for Requester" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "REOPENED", label: "Reopened" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SORT_OPTIONS: { value: string; label: string; sortBy: SortableTicketField; sortDir: "asc" | "desc" }[] = [
  { value: "createdAt-desc", label: "Created Date (Newest First)", sortBy: "createdAt", sortDir: "desc" },
  { value: "createdAt-asc", label: "Created Date (Oldest First)", sortBy: "createdAt", sortDir: "asc" },
  { value: "summary-asc", label: "Summary (A–Z)", sortBy: "summary", sortDir: "asc" },
  { value: "summary-desc", label: "Summary (Z–A)", sortBy: "summary", sortDir: "desc" },
  { value: "requestedPriority-desc", label: "Requested Priority (High First)", sortBy: "requestedPriority", sortDir: "desc" },
  { value: "requestedPriority-asc", label: "Requested Priority (Low First)", sortBy: "requestedPriority", sortDir: "asc" },
  { value: "itPriority-desc", label: "IT Priority (High First)", sortBy: "itPriority", sortDir: "desc" },
  { value: "itPriority-asc", label: "IT Priority (Low First)", sortBy: "itPriority", sortDir: "asc" },
  { value: "status-desc", label: "Current Status (Z–A)", sortBy: "status", sortDir: "desc" },
  { value: "status-asc", label: "Current Status (A–Z)", sortBy: "status", sortDir: "asc" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className="ticket-table__sort-icon" aria-hidden="true">
      {active ? (dir === "asc" ? "▲" : "▼") : ""}
    </span>
  );
}

export default function StaffTicketQueue() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");
  const [itPriorityFilter, setItPriorityFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("");

  const [sortBy, setSortBy] = useState<SortableTicketField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [result, setResult] = useState<StaffTicketListResult | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
    getAssignableUsers()
      .then(setAssignableUsers)
      .catch(() => {});
  }, []);

  // ui-spec.md §13.1 — ~300ms debounce before triggering a refetch. Resets
  // page in the same batch as the debounced value (React 18 auto-batches
  // both setState calls into one render), rather than in a separate effect
  // keyed on the filters — that would fire one fetch with the stale page,
  // then a second right after, a wasted request and a flash of wrong rows.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const ownerIdParam: number | "unassigned" | undefined = useMemo(() => {
    if (ownerFilter === "mine") return user?.id;
    if (ownerFilter === "unassigned") return "unassigned";
    return undefined;
  }, [ownerFilter, user?.id]);

  const params: StaffTicketListParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      itPriority: itPriorityFilter ? (itPriorityFilter as StaffTicketListParams["itPriority"]) : undefined,
      ownerId: ownerIdParam,
      sortBy,
      sortDir,
      page,
      pageSize,
    }),
    [debouncedSearch, statusFilter, itPriorityFilter, ownerIdParam, sortBy, sortDir, page, pageSize],
  );

  // A page number left over from a more-filtered view can point past the
  // end of a less-filtered result set (same reasoning as My Tickets). Each
  // filter's own change handler resets page to 1 directly (see the Status/
  // IT Priority/Owner selects and the search debounce above) instead of a
  // shared effect keyed on the filter values, which would fire one fetch
  // with the stale page before a second one landed on page 1.

  // Guards against out-of-order responses: two quick sort/filter/page
  // changes can resolve in reverse network order, otherwise leaving a
  // stale result on screen after a newer request already returned.
  const latestRequestId = useRef(0);

  const load = useCallback(() => {
    const requestId = ++latestRequestId.current;
    setLoadState("loading");
    getStaffTickets(params)
      .then((res) => {
        if (latestRequestId.current !== requestId) return;
        setResult(res);
        setLoadState("loaded");
      })
      .catch((err: unknown) => {
        if (latestRequestId.current !== requestId) return;
        const status = err instanceof Error ? Number(err.message.match(/status (\d+)/)?.[1]) : undefined;
        setLoadState(status === 403 ? "forbidden" : "error");
      });
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSortClick(field: SortableTicketField) {
    if (field === sortBy) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(defaultSortDir(field));
    }
  }

  function handleMobileSortChange(value: string) {
    const option = SORT_OPTIONS.find((o) => o.value === value);
    if (!option) return;
    setSortBy(option.sortBy);
    setSortDir(option.sortDir);
  }

  function handlePageSizeChange(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function handleStatusFilterChange(value: TicketStatus | "") {
    setStatusFilter(value);
    setPage(1);
  }

  function handleItPriorityFilterChange(value: string) {
    setItPriorityFilter(value);
    setPage(1);
  }

  function handleOwnerFilterChange(value: OwnerFilter) {
    setOwnerFilter(value);
    setPage(1);
  }

  function handleClearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("");
    setItPriorityFilter("");
    setOwnerFilter("");
    setPage(1);
  }

  const hasAnyFilterInput = Boolean(searchInput || statusFilter || itPriorityFilter || ownerFilter);
  const hasCommittedFilter = Boolean(debouncedSearch || statusFilter || itPriorityFilter || ownerFilter);

  const isEmptyState = loadState === "loaded" && result !== null && result.data.length === 0 && !hasCommittedFilter;
  const isNoResultsState = loadState === "loaded" && result !== null && result.data.length === 0 && hasCommittedFilter;

  function categoryName(categoryId: number): string {
    return categories.find((c) => c.id === categoryId)?.name ?? String(categoryId);
  }

  function ownerName(ownerId: number | null): string | null {
    if (ownerId === null) return null;
    return assignableUsers.find((u) => u.id === ownerId)?.name ?? `User #${ownerId}`;
  }

  const start = result && result.totalCount > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = result ? Math.min(result.page * result.pageSize, result.totalCount) : 0;

  if (loadState === "forbidden") {
    return (
      <div className="staff-ticket-queue">
        <h1>Ticket Queue</h1>
        <StateBanner variant="error">
          <p>You don't have access to the Ticket Queue.</p>
        </StateBanner>
      </div>
    );
  }

  return (
    <div className="staff-ticket-queue">
      <h1>Ticket Queue</h1>

      {!isEmptyState && (
        <div className="ticket-toolbar">
          <input
            type="text"
            className="ticket-toolbar__search"
            placeholder="Search by ticket number or summary…"
            aria-label="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          <select
            className="ticket-toolbar__filter"
            aria-label="Status"
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as TicketStatus | "")}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            className="ticket-toolbar__filter"
            aria-label="IT Priority"
            value={itPriorityFilter}
            onChange={(e) => handleItPriorityFilterChange(e.target.value)}
          >
            <option value="">All IT Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>

          <select
            className="ticket-toolbar__filter"
            aria-label="Owner"
            value={ownerFilter}
            onChange={(e) => handleOwnerFilterChange(e.target.value as OwnerFilter)}
          >
            <option value="">All Owners</option>
            <option value="mine">Mine</option>
            <option value="unassigned">Unassigned</option>
          </select>

          <select
            className="ticket-toolbar__page-size"
            aria-label="Page Size"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(e.target.value)}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <select
            className="ticket-toolbar__sort-select"
            aria-label="Sort by"
            value={`${sortBy}-${sortDir}`}
            onChange={(e) => handleMobileSortChange(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="btn btn--secondary ticket-toolbar__clear-filters-btn"
            disabled={!hasAnyFilterInput}
            aria-disabled={!hasAnyFilterInput}
            onClick={handleClearFilters}
          >
            Clear Filters
          </button>
        </div>
      )}

      {loadState === "error" && (
        <StateBanner variant="error">
          <p>Couldn't load the Ticket Queue.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </StateBanner>
      )}

      {loadState !== "error" && isEmptyState && (
        <StateBanner variant="empty">
          <h2>No tickets yet</h2>
          <p>Tickets will appear here once Requesters submit them.</p>
        </StateBanner>
      )}

      {loadState !== "error" && isNoResultsState && (
        <StateBanner variant="no-results">
          <h2>No tickets match your search</h2>
          <p>Try adjusting or clearing your filters.</p>
          <button type="button" className="btn btn--secondary" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </StateBanner>
      )}

      {loadState !== "error" && !isEmptyState && !isNoResultsState && (
        <>
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Ticket No.</th>
                <th className="ticket-table__header--sortable">
                  <button type="button" className="btn btn--tertiary" onClick={() => handleSortClick("createdAt")}>
                    Created Date
                    <SortIcon active={sortBy === "createdAt"} dir={sortDir} />
                  </button>
                </th>
                <th className="ticket-table__header--sortable">
                  <button type="button" className="btn btn--tertiary" onClick={() => handleSortClick("summary")}>
                    Summary
                    <SortIcon active={sortBy === "summary"} dir={sortDir} />
                  </button>
                </th>
                <th>Category</th>
                <th className="ticket-table__header--sortable">
                  <button
                    type="button"
                    className="btn btn--tertiary"
                    onClick={() => handleSortClick("requestedPriority")}
                  >
                    Req. Priority
                    <SortIcon active={sortBy === "requestedPriority"} dir={sortDir} />
                  </button>
                </th>
                <th className="ticket-table__header--sortable">
                  <button type="button" className="btn btn--tertiary" onClick={() => handleSortClick("itPriority")}>
                    IT Priority
                    <SortIcon active={sortBy === "itPriority"} dir={sortDir} />
                  </button>
                </th>
                <th className="ticket-table__header--sortable">
                  <button type="button" className="btn btn--tertiary" onClick={() => handleSortClick("status")}>
                    Status
                    <SortIcon active={sortBy === "status"} dir={sortDir} />
                  </button>
                </th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {loadState === "loading"
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="ticket-table__row--skeleton" data-testid="ticket-skeleton-row">
                      <td colSpan={8}>&nbsp;</td>
                    </tr>
                  ))
                : (result?.data ?? []).map((t: StaffTicket) => (
                    <tr
                      key={t.id}
                      className="ticket-table__row"
                      onClick={() => navigate(`/staff/tickets/${t.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/staff/tickets/${t.id}`);
                      }}
                      tabIndex={0}
                    >
                      <td>{t.ticketNumber}</td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td>{t.summary}</td>
                      <td>{categoryName(t.categoryId)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Badge kind="priority" value={t.requestedPriority} />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Badge kind="priority" value={t.itPriority} itPriority />
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Badge kind="status" value={t.status} />
                      </td>
                      <td>
                        {ownerName(t.ownerId) ?? <span className="owner-chip--unassigned">Unassigned</span>}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          <div className="ticket-card-list">
            {loadState === "loading"
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="ticket-card ticket-card--skeleton" data-testid="ticket-skeleton-card" />
                ))
              : (result?.data ?? []).map((t: StaffTicket) => (
                  <div
                    key={t.id}
                    className="ticket-card"
                    onClick={() => navigate(`/staff/tickets/${t.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/staff/tickets/${t.id}`);
                    }}
                    tabIndex={0}
                  >
                    <div className="ticket-card__header-row">
                      <span className="ticket-card__ticket-number">{t.ticketNumber}</span>
                      <span className="ticket-card__priority-badge" onClick={(e) => e.stopPropagation()}>
                        <Badge kind="priority" value={t.requestedPriority} />
                      </span>
                    </div>
                    <p className="ticket-card__title">{t.summary}</p>
                    <div className="ticket-card__secondary-row">
                      <span>{categoryName(t.categoryId)}</span>
                      <span className="ticket-card__status-badge" onClick={(e) => e.stopPropagation()}>
                        <Badge kind="status" value={t.status} />
                      </span>
                    </div>
                    <div className="ticket-card__footer-row">
                      <span onClick={(e) => e.stopPropagation()}>
                        <span className="ticket-card__footer-label">IT Priority</span>{" "}
                        <Badge kind="priority" value={t.itPriority} itPriority />
                      </span>
                      <span>
                        <span className="ticket-card__footer-label">Owner</span>{" "}
                        {ownerName(t.ownerId) ?? <span className="owner-chip--unassigned">Unassigned</span>}
                      </span>
                    </div>
                  </div>
                ))}
          </div>

          {loadState === "loaded" && result && (
            <>
              <p className="ticket-list__pagination-summary">
                Showing {start}–{end} of {result.totalCount}
              </p>
              <Pagination page={result.page} totalPages={result.totalPages} onPageChange={setPage} />
            </>
          )}
        </>
      )}
    </div>
  );
}
