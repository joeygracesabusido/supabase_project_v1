interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

// Ported from el-property Pagination; chevrons inlined as SVG because this
// app has no lucide-react dependency.
export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => start + i).filter(
    (p) => p <= totalPages,
  );

  const chev = (d: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );

  const btn =
    'rounded-lg border border-[var(--border-color)] p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-[var(--text-secondary)]">
        {total} total result{total !== 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <button aria-label="Previous page" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className={btn}>
          {chev('m15 18-6-6 6-6')}
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            className={`h-9 min-w-[36px] rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? 'bg-[#003580] text-white shadow-sm'
                : 'border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            {p}
          </button>
        ))}
        <button aria-label="Next page" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className={btn}>
          {chev('m9 18 6-6-6-6')}
        </button>
      </div>
    </div>
  );
}
