import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getTickets,
  type Category,
  type Priority,
  type Ticket,
  type TicketListParams,
  type TicketListResult,
} from "../api.js";
import { defaultSortDir, type SortableTicketField } from "../lib/sortDefaults.js";
import Badge from "../components/Badge.js";
import Pagination from "../components/Pagination.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "error";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const SORT_OPTIONS: { value: string; label: string; sortBy: SortableTicketField; sortDir: "asc" | "desc" }[] = [
  { value: "createdAt-desc", label: "Created Date (Newest First)", sortBy: "createdAt", sortDir: "desc" },
  { value: "createdAt-asc", label: "Created Date (Oldest First)", sortBy: "createdAt", sortDir: "asc" },
  { value: "summary-asc", label: "Summary (A–Z)", sortBy: "summary", sortDir: "asc" },
  { value: "summary-desc", label: "Summary (Z–A)", sortBy: "summary", sortDir: "desc" },
  { value: "requestedPriority-desc", label: "Requested Priority (High First)", sortBy: "requestedPriority", sortDir: "desc" },
  { value: "requestedPriority-asc", label: "Requested Priority (Low First)", sortBy: "requestedPriority", sortDir: "asc" },
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

export default function MyTickets() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryIdFilter, setCategoryIdFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [sortBy, setSortBy] = useState<SortableTicketField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [result, setResult] = useState<TicketListResult | null>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // ui-spec.md §13.1 — ~300ms debounce before triggering a refetch.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params: TicketListParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      categoryId: categoryIdFilter ? Number(categoryIdFilter) : undefined,
      requestedPriority: priorityFilter ? (priorityFilter as Priority) : undefined,
      status: statusFilter ? "NEW" : undefined,
      sortBy,
      sortDir,
      page,
      pageSize,
    }),
    [debouncedSearch, categoryIdFilter, priorityFilter, statusFilter, sortBy, sortDir, page, pageSize],
  );

  // A page number left over from a more-filtered view can point past the
  // end of a less-filtered result set — e.g. on page 2 of a category
  // filter, then the filter is loosened to one page's worth of tickets.
  // Without resetting, that stale page returns an empty page of real data,
  // which would misrender as the zero-tickets Empty state.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, categoryIdFilter, priorityFilter, statusFilter]);

  const load = useCallback(() => {
    setLoadState("loading");
    getTickets(params)
      .then((res) => {
        setResult(res);
        setLoadState("loaded");
      })
      .catch(() => {
        setLoadState("error");
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

  function handleClearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setCategoryIdFilter("");
    setPriorityFilter("");
    setStatusFilter("");
    setPage(1);
  }

  const hasAnyFilterInput = Boolean(searchInput || categoryIdFilter || priorityFilter || statusFilter);
  const hasCommittedFilter = Boolean(debouncedSearch || categoryIdFilter || priorityFilter || statusFilter);

  const isEmptyState = loadState === "loaded" && result !== null && result.data.length === 0 && !hasCommittedFilter;
  const isNoResultsState = loadState === "loaded" && result !== null && result.data.length === 0 && hasCommittedFilter;

  function categoryName(categoryId: number): string {
    return categories.find((c) => c.id === categoryId)?.name ?? String(categoryId);
  }

  const start = result && result.totalCount > 0 ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = result ? Math.min(result.page * result.pageSize, result.totalCount) : 0;

  return (
    <div className="my-tickets">
      <h1>My Tickets</h1>

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
            aria-label="Category"
            value={categoryIdFilter}
            onChange={(e) => setCategoryIdFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="ticket-toolbar__filter"
            aria-label="Requested Priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
          </select>

          <select
            className="ticket-toolbar__filter"
            aria-label="Current Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
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

          <button type="button" className="btn btn--primary" onClick={() => navigate("/tickets/new")}>
            Create Ticket
          </button>
        </div>
      )}

      {loadState === "error" && (
        <StateBanner variant="error">
          <p>Couldn't load Tickets.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </StateBanner>
      )}

      {loadState !== "error" && isEmptyState && (
        <StateBanner variant="empty">
          <h2>No tickets yet</h2>
          <p>Create your first ticket to get started.</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate("/tickets/new")}>
            Create Ticket
          </button>
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
                    Requested Priority
                    <SortIcon active={sortBy === "requestedPriority"} dir={sortDir} />
                  </button>
                </th>
                <th className="ticket-table__header--sortable">
                  <button type="button" className="btn btn--tertiary" onClick={() => handleSortClick("status")}>
                    Current Status
                    <SortIcon active={sortBy === "status"} dir={sortDir} />
                  </button>
                </th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {loadState === "loading"
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="ticket-table__row--skeleton" data-testid="ticket-skeleton-row">
                      <td colSpan={7}>&nbsp;</td>
                    </tr>
                  ))
                : (result?.data ?? []).map((t: Ticket) => (
                    <tr
                      key={t.id}
                      className="ticket-table__row"
                      onClick={() => navigate(`/tickets/${t.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/tickets/${t.id}`);
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
                        <Badge kind="status" value={t.status} />
                      </td>
                      <td>{formatDate(t.updatedAt)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>

          <div className="ticket-card-list">
            {loadState === "loading"
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="ticket-card ticket-card--skeleton" data-testid="ticket-skeleton-card" />
                ))
              : (result?.data ?? []).map((t: Ticket) => (
                  <div
                    key={t.id}
                    className="ticket-card"
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") navigate(`/tickets/${t.id}`);
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
                      <span>
                        <span className="ticket-card__footer-label">Created</span> {formatDate(t.createdAt)}
                      </span>
                      <span>
                        <span className="ticket-card__footer-label">Updated</span> {formatDate(t.updatedAt)}
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
