import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Eye, EyeOff } from "lucide-react";
import { login } from "../api/auth";
import { setSession } from "../lib/auth";
import { useTheme } from "../components/ui/ThemeProvider";

export function LoginPage() {
  const navigate = useNavigate();
  const { toggle: toggleTheme, theme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(email, password);
      await setSession(data.token, data.refreshToken);
      localStorage.setItem("userId", data.user.id);
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] flex flex-col">
      {/* Header */}
      <header className="bg-[#003580] shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Building2 size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">
                  IJE Property
                </h1>
                <p className="text-[11px] text-blue-200 leading-tight">
                  Management System
                </p>
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Login card */}
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--border-color)] overflow-hidden">
            {/* Blue accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-[#003580] via-[#0071C2] to-[#003580]" />

            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Welcome back
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Sign in to your property management account
                </p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-[#cc0000] dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-colors"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#003580]/20 focus:border-[#003580] transition-colors"
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-[#003580] hover:bg-[#003070] disabled:opacity-50 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>

              <p className="text-center text-sm text-[var(--text-secondary)] mt-4">
                New user?{" "}
                <button
                  onClick={() => navigate("/register")}
                  className="font-semibold text-[#003580] dark:text-blue-400 hover:underline"
                >
                  Create an account
                </button>
              </p>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-[var(--text-muted)] mt-6">
            IJE Property Management System v1.0
          </p>
        </div>
      </main>
    </div>
  );
}
