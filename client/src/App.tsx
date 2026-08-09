import { useState } from "react";
import { checkSystem, Category } from "./api.js";

// UI states handled below: idle, loading, success, error.
type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [state, setState] = useState<UiState>("idle");
  const [categories, setCategories] = useState<Category[]>([]);
  void categories;

  async function handleCheck() {
    setState("loading");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setState("success");
    } catch {
      setCategories([]);
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button className="btn btn-success" onClick={handleCheck} disabled={state === "loading"}>
        {state === "loading" ? "Loading…" : "Check System"}
      </button>

      {state === "loading" && (
        <p className="text-muted mt-3 mb-0">Checking system…</p>
      )}

      {state === "success" && (
        <div className="alert alert-success mt-3 mb-0" role="status">
          System Status: Online
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-3 mb-0" role="alert">
          <strong>System Status: Offline</strong>
          <div>Unable to connect to TokTickIT API</div>
        </div>
      )}

      {/* TODO(Issue 4): render the category list inside the success state. */}
    </div>
  );
}
