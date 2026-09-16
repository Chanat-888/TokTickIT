import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  createUser,
  getAdminUsers,
  setUserPassword,
  updateUser,
  type Role,
  type User,
} from "../api.js";
import { useAuth } from "../lib/authContext.js";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "../lib/passwordRules.js";
import Field from "../components/Field.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "error" | "forbidden";
type PanelMode = "none" | "create" | "edit";

const ROLE_LABEL: Record<Role, string> = {
  REQUESTER: "Requester",
  IT_STAFF: "IT Staff",
  ADMINISTRATOR: "Administrator",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StatusPill({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="badge badge--user-active">Active</span>
  ) : (
    <span className="badge status-badge--terminal">Inactive</span>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "">("");

  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("REQUESTER");
  const [isActive, setIsActive] = useState(true);
  const [initialPassword, setInitialPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetValue, setPasswordResetValue] = useState("");
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);
  const [passwordResetSubmitting, setPasswordResetSubmitting] = useState(false);

  // ui-spec.md §13.1 convention reused here — ~300ms debounce before
  // triggering a refetch.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Review (PR #53): guards against out-of-order responses, same as
  // StaffTicketQueue.tsx — two quick search/filter changes can resolve in
  // reverse network order, otherwise leaving a stale result on screen after
  // a newer request already returned.
  const latestRequestId = useRef(0);

  const load = useCallback(() => {
    const requestId = ++latestRequestId.current;
    setLoadState("loading");
    getAdminUsers({ search: debouncedSearch || undefined, role: roleFilter || undefined })
      .then((data) => {
        if (latestRequestId.current !== requestId) return;
        setUsers(data);
        setLoadState("loaded");
      })
      .catch((err: unknown) => {
        if (latestRequestId.current !== requestId) return;
        const status = err instanceof Error ? Number(err.message.match(/status (\d+)/)?.[1]) : undefined;
        setLoadState(status === 403 ? "forbidden" : "error");
      });
  }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setPanelMode("create");
    setEditingUser(null);
    setName("");
    setEmail("");
    setRole("REQUESTER");
    setIsActive(true);
    setInitialPassword("");
    setFieldErrors({});
    setSuccessMessage(null);
  }

  function openEdit(u: User) {
    setPanelMode("edit");
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setIsActive(u.isActive);
    setFieldErrors({});
    setSuccessMessage(null);
    setPasswordResetOpen(false);
    setPasswordResetValue("");
    setPasswordResetError(null);
  }

  function closePanel() {
    setPanelMode("none");
    setEditingUser(null);
    setPasswordResetOpen(false);
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = "Name is required";
    if (!EMAIL_RE.test(email.trim())) errors.email = "A valid email is required";
    if (panelMode === "create" && !isValidPassword(initialPassword)) {
      errors.initialPassword = PASSWORD_RULE_MESSAGE;
    }
    return errors;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    if (panelMode === "create") {
      const result = await createUser({ name: name.trim(), email: email.trim(), role, isActive, initialPassword });
      setSubmitting(false);
      if (result.status === 201) {
        setSuccessMessage(`${result.user.name} created.`);
        closePanel();
        load();
      } else if (result.status === 400) {
        setFieldErrors(Object.fromEntries(result.errors.map((fe) => [fe.field, fe.message])));
      } else {
        setFieldErrors({ email: result.error });
      }
      return;
    }

    if (panelMode === "edit" && editingUser) {
      const result = await updateUser(editingUser.id, { name: name.trim(), email: email.trim(), role, isActive });
      setSubmitting(false);
      if (result.status === 200) {
        setSuccessMessage(`${result.user.name} updated.`);
        closePanel();
        load();
      } else if (result.status === 400) {
        setFieldErrors(Object.fromEntries(result.errors.map((fe) => [fe.field, fe.message])));
      } else if (result.error === "Email already in use") {
        setFieldErrors({ email: result.error });
      } else {
        // BR-25/BR-26 conflicts — surfaced next to the Active toggle
        // (ui-spec.md §7 "next to the Deactivate toggle").
        setFieldErrors({ isActive: result.error });
      }
    }
  }

  async function handlePasswordReset() {
    if (!editingUser) return;
    if (!isValidPassword(passwordResetValue)) {
      setPasswordResetError(PASSWORD_RULE_MESSAGE);
      return;
    }
    setPasswordResetSubmitting(true);
    setPasswordResetError(null);
    const result = await setUserPassword(editingUser.id, passwordResetValue);
    setPasswordResetSubmitting(false);
    if (result.status === 200) {
      setPasswordResetOpen(false);
      setPasswordResetValue("");
      setSuccessMessage(`New initial password set for ${editingUser.name}.`);
    } else {
      setPasswordResetError(result.errors[0]?.message ?? PASSWORD_RULE_MESSAGE);
    }
  }

  function handleClearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setRoleFilter("");
  }

  // ui-spec.md §5.7 — self-deactivation/last-Administrator protection
  // renders as a disabled Active toggle; convenience only, the server check
  // is authoritative (specification.md §10).
  const isSelf = editingUser !== null && editingUser.id === currentUser?.id;
  const otherActiveAdmins = useMemo(
    () => users.filter((u) => u.role === "ADMINISTRATOR" && u.isActive && u.id !== editingUser?.id).length,
    [users, editingUser],
  );
  const isSoleActiveAdmin = editingUser?.role === "ADMINISTRATOR" && editingUser?.isActive && otherActiveAdmins === 0;
  const activeToggleDisabled = Boolean(editingUser?.isActive && (isSelf || isSoleActiveAdmin));

  const hasCommittedFilter = Boolean(debouncedSearch || roleFilter);
  const isEmptyState = loadState === "loaded" && users.length === 0 && !hasCommittedFilter;
  const isNoResultsState = loadState === "loaded" && users.length === 0 && hasCommittedFilter;

  if (loadState === "forbidden") {
    return (
      <div className="user-management">
        <h1>User Management</h1>
        <StateBanner variant="error">
          <p>You don't have access to User Management.</p>
        </StateBanner>
      </div>
    );
  }

  return (
    <div className="user-management">
      <h1>User Management</h1>

      {successMessage && (
        <StateBanner variant="success">
          <p>{successMessage}</p>
        </StateBanner>
      )}

      {!isEmptyState && (
        <div className="user-management__toolbar">
          <input
            type="text"
            className="ticket-toolbar__search"
            placeholder="Search by name or email…"
            aria-label="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="ticket-toolbar__filter"
            aria-label="Role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "")}
          >
            <option value="">All Roles</option>
            <option value="REQUESTER">Requester</option>
            <option value="IT_STAFF">IT Staff</option>
            <option value="ADMINISTRATOR">Administrator</option>
          </select>
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            Create User
          </button>
        </div>
      )}

      {panelMode !== "none" && (
        <form
          className="user-form-panel"
          onSubmit={handleSubmit}
          noValidate
          aria-label={panelMode === "create" ? "Create User" : "Edit User"}
        >
          <h2>{panelMode === "create" ? "Create User" : `Edit ${editingUser?.name}`}</h2>

          <div className="user-form-panel__row">
            <Field label="Name" htmlFor="user-form-name" required error={fieldErrors.name}>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email" htmlFor="user-form-email" required error={fieldErrors.email}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>

          <div className="user-form-panel__row">
            <Field label="Role" htmlFor="user-form-role" required error={fieldErrors.role}>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMINISTRATOR">Administrator</option>
              </select>
            </Field>
            {panelMode === "create" && (
              <Field
                label="Initial Password"
                htmlFor="user-form-password"
                required
                error={fieldErrors.initialPassword}
              >
                <input
                  type="password"
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            )}
          </div>

          <div className="user-form-panel__active-toggle-row">
            <label htmlFor="user-form-active">
              <input
                id="user-form-active"
                type="checkbox"
                checked={isActive}
                disabled={activeToggleDisabled}
                onChange={(e) => setIsActive(e.target.checked)}
              />{" "}
              Active
            </label>
            {activeToggleDisabled && (
              <p className="field__message">
                {isSelf
                  ? "You cannot deactivate your own account."
                  : "At least one active Administrator is required."}
              </p>
            )}
          </div>
          {fieldErrors.isActive && <p className="field__message field__message--error">{fieldErrors.isActive}</p>}

          {panelMode === "edit" && editingUser && (
            <div>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setPasswordResetOpen((open) => !open);
                  setPasswordResetError(null);
                  setPasswordResetValue("");
                }}
              >
                Set New Initial Password
              </button>

              {passwordResetOpen && (
                <div className="password-reset-subpanel" role="dialog" aria-label="Set new initial password">
                  <Field
                    label="New Initial Password"
                    htmlFor="user-password-reset"
                    required
                    error={passwordResetError ?? undefined}
                  >
                    <input
                      type="password"
                      value={passwordResetValue}
                      onChange={(e) => setPasswordResetValue(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                  <div className="user-form-panel__actions">
                    <button
                      type="button"
                      className={`btn btn--primary${passwordResetSubmitting ? " btn--busy" : ""}`}
                      disabled={passwordResetSubmitting}
                      aria-busy={passwordResetSubmitting}
                      onClick={handlePasswordReset}
                    >
                      Set Password
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={() => setPasswordResetOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="user-form-panel__actions">
            <button
              type="submit"
              className={`btn btn--primary${submitting ? " btn--busy" : ""}`}
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting && <span className="btn__spinner" aria-hidden="true" />}
              {panelMode === "create" ? "Create User" : "Save Changes"}
            </button>
            <button type="button" className="btn btn--secondary" onClick={closePanel}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadState === "error" && (
        <StateBanner variant="error">
          <p>Couldn't load users.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </StateBanner>
      )}

      {loadState !== "error" && isEmptyState && (
        <StateBanner variant="empty">
          <h2>No users yet</h2>
        </StateBanner>
      )}

      {loadState !== "error" && isNoResultsState && (
        <StateBanner variant="no-results">
          <h2>No users match your search</h2>
          <button type="button" className="btn btn--secondary" onClick={handleClearFilters}>
            Clear Filters
          </button>
        </StateBanner>
      )}

      {loadState !== "error" && !isEmptyState && !isNoResultsState && (
        <>
          <table className="user-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Edit</th>
              </tr>
            </thead>
            <tbody>
              {loadState === "loading"
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} data-testid="user-skeleton-row">
                      <td colSpan={5}>&nbsp;</td>
                    </tr>
                  ))
                : users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="role-badge">{ROLE_LABEL[u.role]}</span>
                      </td>
                      <td>
                        <StatusPill isActive={u.isActive} />
                      </td>
                      <td>
                        <button type="button" className="btn btn--tertiary" onClick={() => openEdit(u)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          <div className="user-card-list">
            {loadState === "loading"
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="user-card" data-testid="user-skeleton-card" />
                ))
              : users.map((u) => (
                  <div key={u.id} className="user-card">
                    <div className="user-card__header-row">
                      <span className="user-card__name">{u.name}</span>
                      <span className="role-badge">{ROLE_LABEL[u.role]}</span>
                    </div>
                    <span>{u.email}</span>
                    <div className="user-card__footer-row">
                      <StatusPill isActive={u.isActive} />
                      <button type="button" className="btn btn--tertiary" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
          </div>
        </>
      )}
    </div>
  );
}
