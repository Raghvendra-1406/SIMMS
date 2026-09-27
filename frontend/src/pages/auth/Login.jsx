import { useState } from "react";
import Icon from "../../components/Icon";
import { BrandMark } from "../../components/AppShell";
import { Spinner } from "../../components/ui";

const API_BASE_URL = "http://localhost:8000";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();

    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Invalid email or password.");
      }

      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_id", String(data.user_id));
      localStorage.setItem("name", data.name);
      localStorage.setItem("email", data.email);
      localStorage.setItem("role", data.role);
      localStorage.setItem("is_active", String(data.is_active));

      if (data.role === "ADMIN") {
        window.location.href = "/admin/dashboard";
      } else if (data.role === "SUPERVISOR") {
        window.location.href = "/supervisor/dashboard";
      } else if (data.role === "MAINTENANCE_STAFF") {
        window.location.href = "/maintenance/dashboard";
      } else {
        setError("Your account has an unsupported role.");
      }
    } catch (err) {
      setError(
        err.message || "Unable to connect to the SIMMS backend."
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: "activity", title: "Live telemetry", text: "Power, light and occupancy readings from every classroom." },
    { icon: "camera", title: "Vision detection", text: "Camera pipeline spots lights and fans left running." },
    { icon: "ticket", title: "Fault to fix", text: "Faults become tickets routed to maintenance automatically." },
  ];

  return (
    <main className="relative min-h-dvh bg-canvas lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* BRAND PANEL */}
      <section className="relative hidden overflow-hidden bg-ink-950 text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Grid + glow backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, black 30%, transparent 75%)",
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-1/4 h-[420px] w-[420px] rounded-full bg-brand-600/25 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-0 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[120px]" />

        <div className="relative z-10 flex items-center gap-3">
          <BrandMark className="h-10 w-10" textClass="text-lg" />
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-[0.16em]">SIMMS</p>
            <p className="text-xs text-ink-400">Smart Infrastructure Monitoring</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl py-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-ink-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Classroom infrastructure, monitored end to end
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight xl:text-[52px]">
            Every classroom,
            <span className="block bg-gradient-to-r from-brand-300 via-brand-200 to-emerald-200 bg-clip-text text-transparent">
              healthy and accounted for.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-ink-300">
            Detect infrastructure faults as they happen, route them to the right people, and keep learning spaces safe and efficient.
          </p>

          <ul className="mt-10 grid gap-3">
            {features.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/20">
                  <Icon name={feature.icon} className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-400">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/[0.06] pt-6 text-xs text-ink-500">
          <p>Smart Classroom Infrastructure Monitoring System</p>
          <p className="flex items-center gap-2 text-ink-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            System ready
          </p>
        </div>
      </section>

      {/* FORM PANEL */}
      <section className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-10 w-10" textClass="text-lg" />
            <div className="leading-tight">
              <p className="text-lg font-bold tracking-[0.16em] text-slate-900">SIMMS</p>
              <p className="text-xs text-slate-500">Smart Infrastructure Monitoring</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-[28px] font-bold tracking-tight text-slate-900">Sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Welcome back. Enter your credentials to access your monitoring workspace.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <div className="relative">
                <Icon name="mail" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  aria-invalid={Boolean(error) && !email.trim()}
                  aria-describedby={error ? "login-error" : undefined}
                  className="input h-11 pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Icon name="lock" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={loading}
                  aria-invalid={Boolean(error) && !password}
                  aria-describedby={error ? "login-error" : undefined}
                  className="input h-11 pl-10 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="btn-icon absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div aria-live="polite" id="login-error">
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                  <Icon name="alertCircle" className="mt-0.5 h-4 w-4 text-red-500" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg group w-full">
              {loading ? (
                <>
                  <Spinner />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <Icon name="arrowRight" className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-card">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Icon name="shield" className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold text-slate-800">Authorized access only</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Restricted to classroom operations and maintenance personnel.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
