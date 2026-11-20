import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { ApiError, signIn, signUp } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Narrow } from "../components/layout";
import { Button, Notice, TextField } from "../components/ui";

export const MIN_PASSWORD_LENGTH = 10;

function useAuthForm(action: () => Promise<void>) {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await action();
      await refresh();
      // Registered users go straight to the quotation builder.
      navigate("/", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return { error, setError, busy, submit };
}

export function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const form = useAuthForm(() => signIn(email.trim(), password));

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <Narrow width="max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Log in</h1>
      <p className="mt-1 text-sm text-muted">Open your saved quotations and company details.</p>
      <form onSubmit={(event) => void form.submit(event)} className="mt-8 space-y-4" noValidate>
        {form.error && <Notice tone="error">{form.error}</Notice>}
        <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" className="w-full" disabled={form.busy || !email || !password}>
          {form.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Log in
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        No account yet?{" "}
        <Link to="/register" className="font-medium text-accent hover:underline">
          Register for free
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted">Password reset by email is not available yet, so keep your password somewhere safe.</p>
    </Narrow>
  );
}

export function Register() {
  const { user, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const form = useAuthForm(async () => {
    if (!name.trim()) throw new ApiError("Please enter your name.", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new ApiError("Please enter a valid email address.", 400);
    if (password.length < MIN_PASSWORD_LENGTH) throw new ApiError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
    await signUp(name.trim(), email.trim(), password);
  });

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <Narrow width="max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Free. Save quotations and your company branding.</p>
      <form onSubmit={(event) => void form.submit(event)} className="mt-8 space-y-4" noValidate>
        {form.error && <Notice tone="error">{form.error}</Notice>}
        <TextField label="Name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={128}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. There is no password reset yet, so store it safely.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" variant="primary" className="w-full" disabled={form.busy}>
          {form.busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-2 text-xs text-muted">
        By creating an account you agree to the{" "}
        <Link to="/terms" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </Narrow>
  );
}
