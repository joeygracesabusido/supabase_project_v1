import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

// Ported from el-property ErrorBoundary; icon inlined (no lucide-react here).
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] p-6">
          <div className="max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center shadow-[var(--shadow-lg)]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mx-auto mb-4 text-red-500">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
            <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
            <p className="mb-6 text-sm text-[var(--text-secondary)]">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#003580] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#00224f]"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
