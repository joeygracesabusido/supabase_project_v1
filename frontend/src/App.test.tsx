import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import App from './App'
import { supabase } from './lib/supabase'

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signUp: async () => ({ data: {}, error: null }),
      signInWithPassword: async () => ({ data: {}, error: null }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ limit: async () => ({ data: [], error: null }) }),
      insert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({ error: null }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  },
}))

afterEach(() => {
  cleanup()
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null } } as never)
})

describe('App', () => {
  it('renders the register form with email and password fields', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: /create account/i })).toBeTruthy()
    expect(screen.getByLabelText(/email/i)).toBeTruthy()
    expect(screen.getByLabelText(/password/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /^register$/i })).toBeTruthy()
  })

  it('toggles to the login form', async () => {
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: /sign in instead/i }))
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^login$/i })).toBeTruthy()
  })

  it('shows dashboard shell when session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } } as never)
    render(<App />)
    expect(await screen.findByText(/property manager/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeTruthy()
  })
})
