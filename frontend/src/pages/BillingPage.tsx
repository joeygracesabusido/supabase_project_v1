import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  DollarSign,
  AlertCircle as AlertCircleIcon,
  TrendingUp,
  Clock,
  Receipt,
  Search,
  ArrowUpDown,
  Calendar,
  Plus,
  CheckCircle2,
} from "lucide-react";
import {
  getBillingStats,
  getPayments,
  getMonthlyCollectionList,
  recordPayment,
} from "../api/billing";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { formatCurrency, formatDate } from "../lib/utils";

export function BillingPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const limit = 20;

  const [collectionParams, setCollectionParams] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
  });
  const [showCollectionList, setShowCollectionList] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ["billing-stats"],
    queryFn: getBillingStats,
    retry: 1,
  });

  const {
    data: paymentsData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["payments", page],
    queryFn: () =>
      getPayments({
        limit: String(limit),
        page: String(page),
        sort_order: "DESC",
      }),
    retry: 1,
  });

  const { data: collectionList, isLoading: isLoadingCollection } = useQuery({
    queryKey: ["billing-collection", collectionParams],
    queryFn: () => getMonthlyCollectionList(collectionParams),
    enabled: showCollectionList,
  });

  const collectMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-stats"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["billing-collection"] });
    },
  });

  const handleCollect = async (item: any) => {
    if (!confirm(`Collect ${formatCurrency(item.total_amount)} from ${item.tenant_name}?`)) return;

    try {
      await collectMutation.mutateAsync({
        lease_id: item.lease_id,
        tenant_id: item.tenant_id,
        amount: item.total_amount,
        payment_date: new Date().toISOString().split("T")[0],
        payment_method: "cash",
        for_month: item.for_month,
        notes: `Collected ${item.source} for ${item.due_date}`,
      });
      alert("Payment collected successfully!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to collect payment.");
    }
  };

  const payments = paymentsData?.data || [];
  const pagination = paymentsData?.pagination || { page: 1, limit: 20, total: 0, total_pages: 0 };

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Billing & Payments"
          subtitle="Track revenue, invoices, and payments"
        />

        {/* Monthly Collection Utility */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 shadow-[var(--shadow-sm)] mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Plus size={20} className="text-[#003580]" />
                Monthly Collection
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Identify and collect due payments for the month
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={collectionParams.month}
                onChange={(e) => setCollectionParams({ ...collectionParams, month: parseInt(e.target.value) })}
                className="px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]/20"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("en-US", { month: "long" })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={collectionParams.year}
                onChange={(e) => setCollectionParams({ ...collectionParams, year: parseInt(e.target.value, 10) })}
                className="w-24 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]/20"
              />
              <button
                onClick={() => setShowCollectionList(!showCollectionList)}
                className="px-4 py-2 bg-[#003580] text-white rounded-lg text-sm font-semibold hover:bg-[#003070] transition-colors shadow-sm"
              >
                {showCollectionList ? "Hide List" : "Generate List"}
              </button>
            </div>
          </div>

          {showCollectionList && (
            <div className="overflow-hidden border border-[var(--border-color)] rounded-lg">
              {isLoadingCollection ? (
                <div className="p-8 text-center text-[var(--text-secondary)]">Loading due payments...</div>
              ) : collectionList?.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-secondary)]">No payments due for this period.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--bg-muted)] border-b border-[var(--border-color)]">
                      <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">Tenant</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">Source</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">Due Date</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase">Amount</th>
                        <th className="px-6 py-3 text-xs font-semibold text-[var(--text-secondary)] uppercase text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {(collectionList ?? []).map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[var(--bg-muted)] transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-[var(--text-primary)]">{item.tenant_name}</td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                            <Badge status={item.type} label={item.source} />
                          </td>
                          <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">{formatDate(item.due_date)}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(item.total_amount)}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleCollect(item)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-md transition-colors"
                            >
                              <CheckCircle2 size={14} /> Collect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {/* Total Revenue Card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <DollarSign size={16} className="text-[#008009]" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    Total Revenue
                  </span>
                </div>
                <p className="text-2xl font-bold text-[#008009]">
                  {formatCurrency(stats?.revenue?.total_revenue ?? 0)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {stats?.revenue?.payment_count ?? 0} payments
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <TrendingUp size={20} className="text-[#008009] opacity-60" />
              </div>
            </div>
          </div>

          {/* Outstanding Card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                    <CreditCard size={16} className="text-[#FEBA02]" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    Outstanding
                  </span>
                </div>
                <p className="text-2xl font-bold text-[#FEBA02]">
                  {formatCurrency(stats?.outstanding?.total_outstanding ?? 0)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {stats?.outstanding?.invoice_count ?? 0} invoices
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center">
                <Clock size={20} className="text-[#FEBA02] opacity-60" />
              </div>
            </div>
          </div>

          {/* Late Payments Card */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertCircleIcon size={16} className="text-[#CC0000]" />
                  </div>
                  <span className="text-sm font-medium text-[var(--text-secondary)]">
                    Late Payments
                  </span>
                </div>
                <p className="text-2xl font-bold text-[#CC0000]">
                  {stats?.late_payments?.late_payment_count ?? 0}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {formatCurrency(stats?.late_payments?.late_payment_total ?? 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <Receipt size={20} className="text-[#CC0000] opacity-60" />
              </div>
            </div>
          </div>
        </div>

        {/* Payments Table Section */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-muted)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#003580] flex items-center justify-center">
                  <Receipt size={16} className="text-white" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    Payments
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {pagination.total || 0} total records
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    type="text"
                    placeholder="Search payments..."
                    className="pl-9 pr-4 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003580] focus:border-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] w-48"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-4 bg-[var(--bg-muted)] rounded-lg animate-pulse"
                >
                  <div className="w-10 h-10 bg-[var(--border-color)] rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--border-color)] rounded w-1/4" />
                    <div className="h-3 bg-[var(--border-color)] rounded w-1/3" />
                  </div>
                  <div className="h-6 bg-[var(--border-color)] rounded w-20" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircleIcon size={24} className="text-[#CC0000]" />
              </div>
              <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                Failed to load payments
              </h4>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
                There was an error fetching payment records. Please try again.
              </p>
              <button
                onClick={() => refetch()}
                className="inline-flex items-center gap-2 bg-[#003580] hover:bg-[#003070] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm"
              >
                <ArrowUpDown size={14} />
                Retry
              </button>
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mx-auto mb-4">
                <CreditCard size={24} className="text-[var(--text-muted)]" />
              </div>
              <h4 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                No payments recorded
              </h4>
              <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                No payment records found. Payments will appear here once processed.
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-color)]">
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={12} />
                          Date
                        </div>
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-6 py-3">
                        Tenant
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-6 py-3">
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={12} />
                          Amount
                        </div>
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-6 py-3">
                        Method
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-6 py-3">
                        Type
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-6 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {payments.map((p: any) => (
                      <tr
                        key={p.id}
                        className="hover:bg-[var(--bg-muted)] transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-sm text-[var(--text-secondary)]">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-[var(--bg-muted)] flex items-center justify-center">
                              <Calendar size={14} className="text-[var(--text-muted)]" />
                            </div>
                            <span>{formatDate(p.payment_date)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#003580] flex items-center justify-center text-white text-sm font-medium">
                              {p.tenant_first_name
                                ? p.tenant_first_name[0]
                                : p.tenant_name?.[0] || "?"}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {p.tenant_first_name
                                  ? `${p.tenant_first_name} ${p.tenant_last_name}`
                                  : p.tenant_name || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {formatCurrency(p.amount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[var(--bg-muted)] text-[var(--text-secondary)] capitalize">
                            {p.payment_method?.replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-[var(--text-secondary)] capitalize">
                            {p.payment_type?.replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            status={p.status || p.payment_status || "pending"}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-muted)]">
                <Pagination
                  page={pagination.page || page}
                  totalPages={pagination.total_pages || 1}
                  total={pagination.total}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
