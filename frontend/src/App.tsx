import { useEffect, useState, type FormEvent } from 'react'
import TiltCard from './components/TiltCard'
import DashboardShell from './components/DashboardShell'
import { supabase } from './lib/supabase'

type AuthUser = { id: string; email: string }

function AuthForm() {
  const [mode, setMode] = useState<'register' | 'login'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logged, setLogged] = useState<AuthUser | null>(null)

  if (logged) {
    return (
      <div
        data-testid="auth-result"
        className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-8 text-center backdrop-blur-xl"
      >
        <p className="text-lg font-semibold text-emerald-200">Signed in as {logged.email}</p>
      </div>
    )
  }

  const valid = email.trim() !== '' && password.length >= 6

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || loading) return
    setLoading(true)
    setError('')
    const trimmed = email.trim()
    const { data, error } =
      mode === 'register'
        ? await supabase.auth.signUp({ email: trimmed, password })
        : await supabase.auth.signInWithPassword({ email: trimmed, password })

    if (error) {
      setError(error.message)
    } else if (data.user) {
      setLogged({ id: data.user.id, email: data.user.email ?? trimmed })
    } else if (mode === 'register') {
      setError('Check your inbox to confirm your email.')
    }
    setLoading(false)
  }

  const toggle = () => {
    setMode(mode === 'register' ? 'login' : 'register')
    setError('')
  }

  return (
    <div className="relative rounded-2xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl [transform-style:preserve-3d]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.18), transparent 60%)',
        }}
      />
      <h1 className="mb-6 text-center text-2xl font-bold tracking-tight text-white [transform:translateZ(45px)]">
        {mode === 'register' ? 'Create account' : 'Sign in'}
      </h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
          />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Password (min 6 chars)
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2.5 text-white placeholder-slate-500 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/40"
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-500/20 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {!valid && !error && (
          <p className="text-xs text-slate-400">Enter an email and a password of at least 6 characters.</p>
        )}
        <button
          type="submit"
          disabled={!valid || loading}
          className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2.5 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Please wait…' : mode === 'register' ? 'Register' : 'Login'}
        </button>
        <button
          type="button"
          onClick={toggle}
          className="w-full rounded-lg border border-white/20 px-4 py-2.5 font-medium text-slate-200 transition hover:bg-white/10"
        >
          {mode === 'register' ? 'Sign in instead' : 'Create an account'}
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === null) return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading…</main>;
  if (!session) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4">
        <div
          aria-hidden
          className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-indigo-600/40 blur-3xl animate-[float-orb_9s_ease-in-out_infinite]"
        />
        <div
          aria-hidden
          className="absolute -bottom-16 -right-10 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-3xl animate-[float-orb_12s_ease-in-out_infinite_reverse]"
        />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/4 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-500/20 blur-3xl animate-[float-orb_14s_ease-in-out_infinite]"
        />
        <div className="group relative w-full max-w-md">
          <TiltCard>
            <AuthForm />
          </TiltCard>
        </div>
      </main>
    );
  }
  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(false);
  };
  return (
    <main className="min-h-screen bg-slate-950">
      <div className="flex justify-end border-b border-white/10 p-2">
        <button onClick={signOut} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10">
          Sign out
        </button>
      </div>
      <DashboardShell />
    </main>
  );
}
