import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext.js";
import { changePassword } from "../api.js";
import { isValidPassword, PASSWORD_RULE_MESSAGE } from "../lib/passwordRules.js";
import Field from "../components/Field.js";
import StateBanner from "../components/StateBanner.js";

type ScreenState = "form" | "submitting";

// docs/lab-03/ui-spec.md §5.2 — shown instead of every other screen while
// mustChangePassword is true (BR-02); also reachable voluntarily later.
export default function ChangePassword() {
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("form");
  const [error, setError] = useState<string | null>(null);

  const newPasswordTouched = newPassword.length > 0;
  const newPasswordError =
    newPasswordTouched && !isValidPassword(newPassword) ? PASSWORD_RULE_MESSAGE : undefined;
  const confirmError =
    confirmPassword.length > 0 && confirmPassword !== newPassword
      ? "Passwords do not match"
      : undefined;

  const canSubmit =
    currentPassword.length > 0 &&
    isValidPassword(newPassword) &&
    newPassword === confirmPassword &&
    screenState !== "submitting";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setScreenState("submitting");

    const result = await changePassword(currentPassword, newPassword);
    if (result.status === 200) {
      await refresh();
      navigate("/", { replace: true });
      return;
    }
    if (result.status === 400) {
      setError(result.errors[0]?.message ?? PASSWORD_RULE_MESSAGE);
    } else {
      setError(result.error);
    }
    setScreenState("form");
  }

  return (
    <div className="auth-screen">
      <h1>Change Password</h1>
      <p>Choose a new password before continuing.</p>

      {error && (
        <StateBanner variant="error">
          <p>{error}</p>
        </StateBanner>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Field label="Current Password" htmlFor="change-password-current" required>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
        </Field>

        <Field
          label="New Password"
          htmlFor="change-password-new"
          required
          error={newPasswordError}
        >
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <Field
          label="Confirm New Password"
          htmlFor="change-password-confirm"
          required
          error={confirmError}
        >
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </Field>

        <button
          type="submit"
          className={`btn btn--primary${screenState === "submitting" ? " btn--busy" : ""}`}
          disabled={!canSubmit}
          aria-busy={screenState === "submitting"}
        >
          {screenState === "submitting" && <span className="btn__spinner" aria-hidden="true" />}
          {screenState === "submitting" ? "Saving…" : "Save New Password"}
        </button>
      </form>
    </div>
  );
}
