import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext.js";
import Field from "../components/Field.js";
import StateBanner from "../components/StateBanner.js";

type ScreenState = "form" | "submitting";

// docs/lab-03/ui-spec.md §5.1 — generic wording for wrong credentials
// (BR-09) vs. the distinct inactive-account wording (BR-10); both render in
// the same error styling, differing only in copy.
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (screenState === "submitting") return;
    setError(null);
    setScreenState("submitting");

    const result = await login(email, password);
    if (result.status === 200) {
      navigate(result.user.mustChangePassword ? "/change-password" : "/", { replace: true });
      return;
    }
    if (result.status === 400) {
      setError(result.errors[0]?.message ?? "Email and password are required");
    } else {
      setError(result.error);
    }
    setScreenState("form");
  }

  return (
    <div className="auth-screen">
      <h1>TokTickIT</h1>

      {error && (
        <StateBanner variant="error">
          <p>{error}</p>
        </StateBanner>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Email" htmlFor="login-email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </Field>

        <Field label="Password" htmlFor="login-password" required>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <button
          type="submit"
          className={`btn btn--primary${screenState === "submitting" ? " btn--busy" : ""}`}
          disabled={screenState === "submitting" || !email || !password}
          aria-busy={screenState === "submitting"}
        >
          {screenState === "submitting" && <span className="btn__spinner" aria-hidden="true" />}
          {screenState === "submitting" ? "Logging in…" : "Log In"}
        </button>
      </form>
    </div>
  );
}
