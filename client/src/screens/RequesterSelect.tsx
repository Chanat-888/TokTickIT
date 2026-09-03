import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getRequesters, type Requester } from "../api.js";
import { useRequester } from "../lib/requesterContext.js";
import StateBanner from "../components/StateBanner.js";

type LoadState = "loading" | "loaded" | "empty" | "error";

export default function RequesterSelect() {
  const [state, setState] = useState<LoadState>("loading");
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const { selectRequester } = useRequester();
  const navigate = useNavigate();

  const load = useCallback(() => {
    setState("loading");
    getRequesters()
      .then((data) => {
        setRequesters(data);
        setState(data.length === 0 ? "empty" : "loaded");
      })
      .catch(() => {
        setState("error");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleContinue() {
    const requester = requesters.find((r) => String(r.id) === selectedId);
    if (!requester) return;
    selectRequester(requester);
    navigate("/tickets");
  }

  return (
    <div className="requester-select">
      <h1>TokTickIT</h1>
      <p>
        Select a Development Requester to test requester-specific ticket
        behavior. This is not a login screen. Authentication and role-based
        access will be introduced in Lab 3.
      </p>

      {state === "loading" && (
        <StateBanner variant="loading">
          <span
            className="btn__spinner"
            aria-hidden="true"
            style={{
              borderColor: "var(--color-field-border)",
              borderTopColor: "var(--color-secondary-green)",
              display: "inline-block",
              marginRight: "var(--space-xs)",
              verticalAlign: "middle",
            }}
          />
          Loading Requesters…
        </StateBanner>
      )}

      {state === "error" && (
        <StateBanner variant="error">
          <p>Couldn't load Development Requesters.</p>
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </StateBanner>
      )}

      {state === "empty" && <p>No active Development Requesters are available.</p>}

      {state === "loaded" && (
        <div>
          <label htmlFor="requester-select-dropdown">Development Requester</label>
          <select
            id="requester-select-dropdown"
            className="requester-select__dropdown"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select a Requester…</option>
            {requesters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary requester-select__continue-btn"
        disabled={!selectedId}
        onClick={handleContinue}
      >
        Continue
      </button>
    </div>
  );
}
