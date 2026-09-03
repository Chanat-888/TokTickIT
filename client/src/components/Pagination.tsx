interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// ui-spec.md §13.5, §19 — this dataset never exceeds 3 pages (25 seeded
// Tickets max, 10/page min), so every page button renders, no ellipsis.
export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn btn--tertiary pagination__prev"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>

      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`btn btn--tertiary pagination__page-btn${p === page ? " pagination__page-btn--active" : ""}`}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        className="btn btn--tertiary pagination__next"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
