"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AuthMode = "login" | "register";

type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  created_at?: string;
};

type AuthPayload = {
  message: string;
  token: string;
  user: AuthenticatedUser;
};

type ProfilePayload = {
  user: AuthenticatedUser;
};

type MessagePayload = {
  message: string;
};

type ApiErrorPayload = {
  message?: string;
  errors?: Record<string, string[]>;
};

type FormState = {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
};

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "") || "/api";
const TOKEN_STORAGE_KEY = "hybrid-stack.auth-token";

function extractErrorMessage(payload: ApiErrorPayload | null, fallback: string) {
  if (!payload) {
    return fallback;
  }

  const firstValidationError = payload.errors
    ? Object.values(payload.errors).flat()[0]
    : undefined;

  return firstValidationError ?? payload.message ?? fallback;
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as T | ApiErrorPayload)
    : null;

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(payload as ApiErrorPayload | null, "Request failed."),
    );
  }

  return payload as T;
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const bootstrapSession = async () => {
      const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);

      if (!storedToken) {
        if (active) {
          setBootstrapLoading(false);
        }

        return;
      }

      try {
        const payload = await apiRequest<ProfilePayload>(
          "/me",
          { method: "GET" },
          storedToken,
        );

        if (!active) {
          return;
        }

        setToken(storedToken);
        setUser(payload.user);
      } catch {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY);

        if (!active) {
          return;
        }

        setToken(null);
        setUser(null);
      } finally {
        if (active) {
          setBootstrapLoading(false);
        }
      }
    };

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user && token), [token, user]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (mode === "register" && form.password !== form.passwordConfirmation) {
      setErrorMessage("Password confirmation does not match.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = await apiRequest<AuthPayload>(
        mode === "login" ? "/login" : "/register",
        {
          method: "POST",
          body: JSON.stringify(
            mode === "login"
              ? {
                  email: form.email,
                  password: form.password,
                }
              : {
                  name: form.name,
                  email: form.email,
                  password: form.password,
                  password_confirmation: form.passwordConfirmation,
                },
          ),
        },
      );

      window.localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      setToken(payload.token);
      setUser(payload.user);
      setSuccessMessage(payload.message);
      setForm({
        name: payload.user.name,
        email: payload.user.email,
        password: "",
        passwordConfirmation: "",
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to complete the request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (!token) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = await apiRequest<MessagePayload>(
        "/logout",
        { method: "POST" },
        token,
      );

      setSuccessMessage(payload.message);
    } catch {
      setSuccessMessage("Session cleared on this device.");
    } finally {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      setToken(null);
      setUser(null);
      setSubmitting(false);
      setMode("login");
      setForm((current) => ({
        ...current,
        password: "",
        passwordConfirmation: "",
      }));
    }
  };

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur xl:p-10">
          <div className="space-y-6">
            <span className="inline-flex w-fit rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-200">
              Hybrid Stack access portal
            </span>

            <div className="space-y-4">
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Frontend demo gone. Real authentication is in.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Users can now create an account, sign in from the Next.js app,
                and stay authenticated with API tokens issued by Laravel Sanctum.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  title: "User registration",
                  description: "Create accounts directly from the frontend with validation-ready fields.",
                },
                {
                  title: "Secure login",
                  description: "Authenticate against the Laravel API and keep the session token in the browser.",
                },
                {
                  title: "Profile bootstrap",
                  description: "Reloads the current user automatically when a saved token is still valid.",
                },
                {
                  title: "API ready",
                  description: `Configured endpoint: ${API_BASE_URL}`,
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <h2 className="text-lg font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <a
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 transition hover:bg-white/10"
              href="/api/health"
            >
              API health check
            </a>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-emerald-200">
              Token auth enabled
            </span>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-8">
          {bootstrapLoading ? (
            <div className="flex min-h-[32rem] items-center justify-center text-sm text-slate-300">
              Restoring your session...
            </div>
          ) : isAuthenticated && user ? (
            <div className="flex min-h-[32rem] flex-col justify-between gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-200/80">
                    Signed in
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    Welcome back, {user.name}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Your frontend is now talking to Laravel auth endpoints instead
                    of showing the default placeholder screen.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Name
                    </p>
                    <p className="mt-3 text-lg font-medium text-white">{user.name}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      Email
                    </p>
                    <p className="mt-3 text-lg font-medium text-white">{user.email}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm leading-6 text-emerald-100">
                  Session token is stored in this browser, so a refresh will try to
                  restore the logged-in user automatically.
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={submitting}
                className="inline-flex justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Signing out..." : "Logout"}
              </button>
            </div>
          ) : (
            <div className="flex min-h-[32rem] flex-col">
              <div className="inline-flex rounded-2xl bg-slate-900/60 p-1">
                {(["login", "register"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => switchMode(tab)}
                    className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
                      mode === tab
                        ? "bg-white text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="mt-8 space-y-2">
                <h2 className="text-3xl font-semibold text-white">
                  {mode === "login" ? "Login to your account" : "Create a new account"}
                </h2>
                <p className="text-sm leading-6 text-slate-300">
                  {mode === "login"
                    ? "Enter your email and password to continue."
                    : "Fill in the details below to register from the frontend."}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 flex flex-1 flex-col gap-5">
                {mode === "register" ? (
                  <label className="space-y-2 text-sm text-slate-200">
                    <span>Full name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(event) => updateField("name", event.target.value)}
                      autoComplete="name"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                      placeholder="Jane Doe"
                      required
                    />
                  </label>
                ) : null}

                <label className="space-y-2 text-sm text-slate-200">
                  <span>Email address</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    autoComplete="email"
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                    placeholder="you@example.com"
                    required
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-200">
                  <span>Password</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                    placeholder="••••••••"
                    required
                  />
                </label>

                {mode === "register" ? (
                  <label className="space-y-2 text-sm text-slate-200">
                    <span>Confirm password</span>
                    <input
                      type="password"
                      value={form.passwordConfirmation}
                      onChange={(event) =>
                        updateField("passwordConfirmation", event.target.value)
                      }
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                      placeholder="Repeat your password"
                      required
                    />
                  </label>
                ) : null}

                {errorMessage ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                    {errorMessage}
                  </div>
                ) : null}

                {successMessage ? (
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                    {successMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-auto inline-flex justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Login"
                      : "Register"}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
