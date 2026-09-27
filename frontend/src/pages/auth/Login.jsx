import { useState } from "react";

const API_BASE_URL = "http://localhost:8000";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center">

        <div className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-2xl shadow-black/30 lg:grid-cols-[1.05fr_0.95fr]">

          {/* LEFT PANEL */}
          <section className="relative hidden min-h-[680px] overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-10 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">

            {/* Decorative circles */}
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[45px] border-cyan-400/10" />
            <div className="absolute -bottom-32 -left-28 h-80 w-80 rounded-full border-[50px] border-blue-400/10" />
            <div className="absolute right-20 top-1/2 h-32 w-32 rounded-full bg-cyan-400/5 blur-3xl" />

            <div className="relative z-10">

              {/* Logo */}
              <div className="mb-20 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-xl font-black text-slate-950 shadow-lg shadow-cyan-400/20">
                  S
                </div>

                <div>
                  <p className="text-xl font-bold tracking-[0.22em]">
                    SIMMS
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Smart Infrastructure
                  </p>
                </div>
              </div>

              <div className="max-w-lg">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  Classroom infrastructure monitoring
                </div>

                <h1 className="text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
                  Smarter classrooms.
                  <span className="block text-cyan-300">
                    Better infrastructure.
                  </span>
                </h1>

                <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
                  Monitor classroom conditions, detect infrastructure
                  faults, and keep learning spaces safe and operational.
                </p>
              </div>

              {/* Feature indicators */}
              <div className="mt-12 grid max-w-lg grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-lg font-bold text-white">24/7</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Monitoring
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-lg font-bold text-white">AI</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Detection
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                  <p className="text-lg font-bold text-white">IoT</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Connected
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6">
              <p className="text-xs text-slate-500">
                Smart Classroom Infrastructure Monitoring System
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                System ready
              </div>
            </div>
          </section>

          {/* RIGHT PANEL */}
          <section className="flex min-h-[680px] items-center justify-center bg-white px-6 py-12 sm:px-12 lg:px-16">

            <div className="w-full max-w-md">

              {/* Mobile logo */}
              <div className="mb-12 flex items-center gap-3 lg:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-cyan-300">
                  S
                </div>

                <div>
                  <p className="text-xl font-bold tracking-[0.2em] text-slate-900">
                    SIMMS
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    Smart Infrastructure
                  </p>
                </div>
              </div>

              {/* Heading */}
              <div className="mb-9">
                <p className="mb-3 text-sm font-semibold text-cyan-700">
                  Welcome back
                </p>

                <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                  Sign in to SIMMS
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Access your classroom monitoring and infrastructure
                  management workspace.
                </p>
              </div>

              {/* FORM */}
              <form onSubmit={handleLogin} className="space-y-6">

                {/* Email */}
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@college.edu"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-slate-700"
                    >
                      Password
                    </label>
                  </div>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {/* Error */}
                <div
                  aria-live="polite"
                  className={`min-h-6 rounded-lg text-sm ${
                    error
                      ? "border border-red-100 bg-red-50 px-3 py-2 text-red-600"
                      : ""
                  }`}
                >
                  {error}
                </div>

                {/* Login button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in to SIMMS
                      <span className="transition-transform group-hover:translate-x-1">
                        →
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* Bottom information */}
              <div className="mt-10 border-t border-slate-100 pt-6">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    🔒
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Authorized access
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      This system is restricted to authorized classroom
                      operations and maintenance personnel.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </section>
        </div>
      </div>
    </main>
  );
}