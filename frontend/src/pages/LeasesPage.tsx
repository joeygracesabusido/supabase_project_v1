import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Search,
  AlertCircle,
  Building2,
  Calendar,
  ChevronRight,
  User,
} from "lucide-react";
import { getLeases } from "../api/leases";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { formatDate } from "../lib/utils";

export function LeasesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leases", search, page],
    queryFn: () =>
      getLeases({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      }),
    retry: 1,
  });

  const leases = data?.data || [];
  const pagination = data?.pagination || { page, total: 0, total_pages: 0 };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1
                style={{
                  fontSize: "1.875rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: "0.5rem",
                }}
              >
                Leases
              </h1>
              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--text-secondary)",
                }}
              >
                {pagination.total || 0} lease agreement
                {pagination.total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div
          className="mb-6 rounded-lg"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              data-search
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by tenant name or property..."
              style={{
                width: "100%",
                padding: "1rem 1rem 1rem 3rem",
                backgroundColor: "transparent",
                border: "none",
                fontSize: "0.9375rem",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg animate-pulse"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  height: "7rem",
                }}
              />
            ))}
          </div>
        ) : isError ? (
          /* Error State */
          <div
            className="rounded-lg text-center"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              padding: "4rem 2rem",
            }}
          >
            <AlertCircle
              size={48}
              style={{
                color: "var(--text-muted)",
                margin: "0 auto 1rem",
                opacity: 0.5,
              }}
            />
            <p
              style={{
                fontWeight: 600,
                color: "#CC0000",
                marginBottom: "0.25rem",
              }}
            >
              Failed to load leases
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                marginBottom: "1.5rem",
              }}
            >
              There was an error fetching your leases.
            </p>
            <button
              onClick={() => refetch()}
              className="rounded-lg"
              style={{
                backgroundColor: "#003580",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 500,
                padding: "0.625rem 1.5rem",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#00224F")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#003580")
              }
            >
              Retry
            </button>
          </div>
        ) : leases.length === 0 ? (
          /* Empty State */
          <div
            className="rounded-lg text-center"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              padding: "4rem 2rem",
            }}
          >
            <FileText
              size={48}
              style={{
                color: "var(--text-muted)",
                margin: "0 auto 1rem",
                opacity: 0.5,
              }}
            />
            <p
              style={{
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "0.25rem",
              }}
            >
              No leases found
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
              }}
            >
              {search
                ? "Try adjusting your search terms"
                : "Create a lease to link a tenant to a unit."}
            </p>
          </div>
        ) : (
          /* Lease Cards */
          <div className="grid gap-4">
            {leases.map((l: any) => (
              <div
                key={l.id}
                className="block rounded-lg"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-sm)",
                  transition: "box-shadow 0.2s, transform 0.15s",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Tenant Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div
                        className="rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          width: "3rem",
                          height: "3rem",
                          backgroundColor: "#E8F0FE",
                        }}
                      >
                        <User size={20} style={{ color: "#003580" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3
                            style={{
                              fontSize: "1rem",
                              fontWeight: 600,
                              color: "var(--text-primary)",
                              margin: 0,
                            }}
                          >
                            {l.tenant_name}
                          </h3>
                          <Badge status={l.status || "pending"} />
                        </div>
                        {l.tenant_email && (
                          <p
                            style={{
                              fontSize: "0.8125rem",
                              color: "var(--text-secondary)",
                              margin: 0,
                            }}
                          >
                            {l.tenant_email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Arrow */}
                    <ChevronRight
                      size={20}
                      style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "0.25rem" }}
                    />
                  </div>

                  {/* Details Grid */}
                  <div
                    className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4"
                    style={{ borderTop: "1px solid var(--border-color)" }}
                  >
                    {/* Property / Unit */}
                    <div className="flex items-start gap-2">
                      <Building2
                        size={16}
                        style={{ color: "var(--text-muted)", marginTop: "0.125rem", flexShrink: 0 }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            margin: 0,
                            marginBottom: "0.125rem",
                          }}
                        >
                          Property
                        </p>
                        <p
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            margin: 0,
                          }}
                        >
                          {l.property_name}
                          {l.unit_number && (
                            <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>
                              {" "}
                              · Unit {l.unit_number}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Period */}
                    <div className="flex items-start gap-2">
                      <Calendar
                        size={16}
                        style={{ color: "var(--text-muted)", marginTop: "0.125rem", flexShrink: 0 }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            margin: 0,
                            marginBottom: "0.125rem",
                          }}
                        >
                          Period
                        </p>
                        <p
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--text-primary)",
                            margin: 0,
                          }}
                        >
                          {l.start_date
                            ? formatDate(l.start_date)
                            : "—"}
                          <span style={{ color: "var(--text-muted)", margin: "0 0.375rem" }}>
                            →
                          </span>
                          {l.end_date
                            ? formatDate(l.end_date)
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Rent */}
                    <div className="flex items-start gap-2">
                      <div
                        className="rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          width: "1rem",
                          height: "1rem",
                          marginTop: "0.125rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                          }}
                        >
                          ₱
                        </span>
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            margin: 0,
                            marginBottom: "0.125rem",
                          }}
                        >
                          Monthly Rent
                        </p>
                        <p
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "#008009",
                            margin: 0,
                          }}
                        >
                          {l.total_rent_amount
                            ? `₱${Number(l.total_rent_amount).toLocaleString()}`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && leases.length > 0 && (
          <div className="mt-6">
            <Pagination
              page={pagination.page || page}
              totalPages={pagination.total_pages || 1}
              total={pagination.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
