import { useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Home,
  Users,
  Wrench,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  ChevronRight,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Handshake,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { getDashboardOverview, getDashboardRevenue } from "../api/dashboard";
import { formatCurrency } from "../lib/utils";
import { getCurrentUser } from "../lib/auth";

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    data: overview,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: getDashboardOverview,
    retry: 1,
  });

  const { data: revenue } = useQuery({
    queryKey: ["dashboard-revenue"],
    queryFn: () => getDashboardRevenue({ period: "monthly" }),
    retry: 1,
  });

  const [user, setUser] = useState<{ id?: string; name?: string }>({});
  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => {});
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-page)",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            style={{
              fontSize: "1.875rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            Welcome back, {user.name?.split(" ")[0] || "Admin"}
          </h1>
          <p
            style={{
              fontSize: "0.9375rem",
              color: "var(--text-secondary)",
            }}
          >
            Here's an overview of your property portfolio
          </p>
        </div>

        {/* Empty State - Welcome Banner */}
        {!isLoading &&
          !isError &&
          overview &&
          (overview.total_properties ?? 0) === 0 && (
            <div
              className="rounded-xl"
              style={{
                background: "linear-gradient(135deg, #003580 0%, #0071C2 100%)",
                padding: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              <h2
                style={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  marginBottom: "0.25rem",
                }}
              >
                Welcome to IJE Property Management!
              </h2>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "rgba(255,255,255,0.8)",
                  marginBottom: "1rem",
                }}
              >
                Get started in a few simple steps.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <button
                  onClick={() => navigate("/properties")}
                  className="flex items-center gap-3 rounded-lg text-left"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.15)",
                    padding: "0.875rem 1rem",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "#ffffff",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.25)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      "rgba(255,255,255,0.15)")
                  }
                >
                  <Building2 size={18} />
                  <span>Add your first property</span>
                  <ArrowRight size={14} className="ml-auto" />
                </button>
                <div
                  className="flex items-center gap-3 rounded-lg"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    padding: "0.875rem 1rem",
                    fontSize: "0.875rem",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <Home size={18} />
                  <span>Create units</span>
                </div>
                <div
                  className="flex items-center gap-3 rounded-lg"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.08)",
                    padding: "0.875rem 1rem",
                    fontSize: "0.875rem",
                    color: "rgba(255,255,255,0.6)",
                  }}
                >
                  <Users size={18} />
                  <span>Add tenants</span>
                </div>
              </div>
            </div>
          )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl animate-pulse"
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
            className="rounded-xl text-center"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
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
              Failed to load dashboard
            </p>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                marginBottom: "1.5rem",
              }}
            >
              There was an error fetching your dashboard data.
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
        ) : (
          /* Stats Cards */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Total Properties"
              value={overview?.total_properties ?? "—"}
              icon={<Building2 size={20} />}
              iconBg="#E8F0FE"
              iconColor="#003580"
            />
            <StatCard
              label="Total Units"
              value={overview?.total_units ?? "—"}
              sub={`${overview?.occupancy_rate ?? 0}% occupied`}
              icon={<Home size={20} />}
              iconBg="#E8F4FD"
              iconColor="#0071C2"
            />
            <StatCard
              label="Active Tenants"
              value={overview?.active_tenants ?? "—"}
              icon={<Users size={20} />}
              iconBg="#E6F4EA"
              iconColor="#008009"
            />
            <StatCard
              label="Open Tickets"
              value={overview?.open_tickets ?? "—"}
              icon={<Wrench size={20} />}
              iconBg="#FEF3E2"
              iconColor="#CC7A00"
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <div
            className="lg:col-span-2 rounded-xl"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              padding: "1.5rem",
            }}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    backgroundColor: "#E8F0FE",
                  }}
                >
                  <TrendingUp size={18} style={{ color: "#003580" }} />
                </div>
                <div>
                  <h3
                    style={{
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      fontSize: "0.9375rem",
                    }}
                  >
                    Monthly Revenue
                  </h3>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    Last 12 months performance
                  </p>
                </div>
              </div>
            </div>
            {revenue?.monthly && revenue.monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={revenue.monthly}
                  margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid var(--border-color)",
                      boxShadow: "var(--shadow-md)",
                      fontSize: "0.8125rem",
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#003580"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div
                className="flex items-center justify-center"
                style={{
                  height: "15rem",
                  color: "var(--text-muted)",
                  fontSize: "0.875rem",
                }}
              >
                No revenue data available
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Financial Summary */}
            <div
              className="rounded-xl"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
                padding: "1.5rem",
              }}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    backgroundColor: "#E6F4EA",
                  }}
                >
                  <DollarSign size={18} style={{ color: "#008009" }} />
                </div>
                <h3
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                  }}
                >
                  Financial Summary
                </h3>
              </div>
              <div className="space-y-4">
                <FinancialRow
                  label="Collected This Month"
                  value={overview?.monthly_revenue}
                  icon={<CreditCard size={14} />}
                  valueColor="#008009"
                />
                <FinancialRow
                  label="Outstanding Balance"
                  value={overview?.outstanding_balance}
                  icon={<AlertTriangle size={14} />}
                  valueColor="#CC7A00"
                />
                <FinancialRow
                  label="Maintenance Costs"
                  value={overview?.maintenance_costs}
                  icon={<Wrench size={14} />}
                  valueColor="#0071C2"
                />
              </div>
            </div>

            {/* Sales & Financing Pipeline */}
            <div
              className="rounded-xl cursor-pointer"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
                padding: "1.5rem",
              }}
              onClick={() => navigate("/sales")}
            >
              <div className="flex items-center gap-3 mb-5">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{
                    width: "2.25rem",
                    height: "2.25rem",
                    backgroundColor: "#E8F0FE",
                  }}
                >
                  <Handshake size={18} style={{ color: "#003580" }} />
                </div>
                <h3
                  style={{
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    fontSize: "0.9375rem",
                  }}
                >
                  Sales & Financing
                </h3>
              </div>
              <div className="space-y-4">
                <FinancialRow
                  label="Active Sales"
                  value={overview?.sales_active_count}
                  icon={<Handshake size={14} />}
                  valueColor="#003580"
                  format="number"
                />
                <FinancialRow
                  label="Pipeline Value"
                  value={overview?.sales_pipeline_value}
                  icon={<CreditCard size={14} />}
                  valueColor="#003580"
                />
                <FinancialRow
                  label="Pending Financing Review"
                  value={overview?.sales_pending_financing}
                  icon={<AlertTriangle size={14} />}
                  valueColor="#CC7A00"
                  format="number"
                />
                <FinancialRow
                  label="Completed Sales Value"
                  value={overview?.sales_completed_value}
                  icon={<DollarSign size={14} />}
                  valueColor="#008009"
                />
              </div>
            </div>

            {/* Overdue Leases Alert */}
            {overview != null && overview.overdue_leases > 0 && (
              <div
                className="rounded-xl"
                style={{
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FECACA",
                  padding: "1rem 1.25rem",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-lg flex items-center justify-center"
                    style={{
                      width: "2rem",
                      height: "2rem",
                      backgroundColor: "#FEE2E2",
                    }}
                  >
                    <AlertCircle size={16} style={{ color: "#CC0000" }} />
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#991B1B",
                      }}
                    >
                      {overview.overdue_leases} overdue lease
                      {overview.overdue_leases !== 1 ? "s" : ""}
                    </p>
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "#B91C1C",
                        marginTop: "0.125rem",
                      }}
                    >
                      Immediate attention required
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div
              className="rounded-xl"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
                padding: "1.5rem",
              }}
            >
              <h3
                style={{
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontSize: "0.9375rem",
                  marginBottom: "1rem",
                }}
              >
                Quick Actions
              </h3>
              <div className="space-y-2">
                <QuickAction
                  label="View Properties"
                  onClick={() => navigate("/properties")}
                />
                <QuickAction
                  label="Manage Tenants"
                  onClick={() => navigate("/tenants")}
                />
                <QuickAction
                  label="Sales & Financing"
                  onClick={() => navigate("/sales")}
                />
                <QuickAction
                  label="Maintenance Requests"
                  onClick={() => navigate("/maintenance")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      className="rounded-xl"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
        padding: "1.25rem",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="rounded-lg flex items-center justify-center"
          style={{
            width: "2.5rem",
            height: "2.5rem",
            backgroundColor: iconBg,
          }}
        >
          <span style={{ color: iconColor }}>{icon}</span>
        </div>
      </div>
      <p
        style={{
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </p>
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--text-secondary)",
          marginTop: "0.25rem",
        }}
      >
        {label}
      </p>
      {sub && (
        <p
          style={{
            fontSize: "0.75rem",
            color: "#008009",
            marginTop: "0.375rem",
            fontWeight: 500,
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function FinancialRow({
  label,
  value,
  icon,
  valueColor,
  format = "currency",
}: {
  label: string;
  value?: number | string;
  icon: ReactNode;
  valueColor: string;
  format?: "currency" | "number";
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--text-muted)" }}>{icon}</span>
        <span
          style={{
            fontSize: "0.8125rem",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: valueColor,
        }}
      >
        {format === "currency" ? formatCurrency(value ?? 0) : Number(value ?? 0).toLocaleString()}
      </span>
    </div>
  );
}

function QuickAction({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between w-full rounded-lg text-left"
      style={{
        padding: "0.75rem 1rem",
        backgroundColor: "var(--bg-muted)",
        fontSize: "0.8125rem",
        fontWeight: 500,
        color: "var(--text-primary)",
        transition: "background-color 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--border-color)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "var(--bg-muted)")
      }
    >
      <span>{label}</span>
      <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
    </button>
  );
}
