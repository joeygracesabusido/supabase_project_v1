import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProperties } from "../api/properties";
import {
  getWaterBills,
  getWaterReadings,
  createWaterBill,
  markWaterBillPaid,
  createWaterReading,
  type NewWaterBillInput,
} from "../api/water";
import {
  Droplets,
  DollarSign,
  Search,
  Plus,
  Gauge,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  CreditCard,
  SlidersHorizontal,
  X,
  Building,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { StatCard } from "../components/ui/StatCard";
import { formatCurrency, formatDate } from "../lib/utils";

// Water billing over Supabase (tables water_bills + water_readings, adapter
// ../api/water.ts). Seeded with the el-property demo rows. The RUBS calculator
// and the tariff tab stay client-side demos, exactly as in the source.

export interface WaterBill {
  id: string;
  billNumber: string;
  property: string;
  unit: string;
  tenant: string;
  method: "submeter" | "rubs";
  previousReading?: number;
  currentReading?: number;
  consumption?: number; // in m³
  rubsFactor?: string; // e.g., "2 Occupants (12.5%)"
  ratePerUnit: number;
  baseCharge: number;
  sewerFee: number;
  totalAmount: number;
  billingPeriod: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  paymentDate?: string;
  paymentMethod?: string;
}

export interface MeterReading {
  id: string;
  meterId: string;
  property: string;
  unit: string;
  tenant: string;
  previousReading: number;
  currentReading: number;
  consumption: number;
  readingDate: string;
  readerName: string;
  leakWarning?: boolean;
}

function apiError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function WaterTransactionsPage({ defaultTab }: { defaultTab?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab") || defaultTab || "bills";
  const methodParam = searchParams.get("method");
  const statusParam = searchParams.get("status");

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (urlTab === "submeter" || urlTab === "rubs" || urlTab === "unpaid") return "bills";
    return urlTab;
  });

  const queryClient = useQueryClient();
  const billsQuery = useQuery({
    queryKey: ["water", "bills"],
    queryFn: getWaterBills,
    retry: 1,
  });
  const readingsQuery = useQuery({
    queryKey: ["water", "readings"],
    queryFn: getWaterReadings,
    retry: 1,
  });
  const bills = billsQuery.data || [];
  const readings = readingsQuery.data || [];

  // Dropdown filter states
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>(() => {
    if (urlTab === "submeter") return "submeter";
    if (urlTab === "rubs") return "rubs";
    return "all";
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (urlTab === "unpaid") return "unpaid";
    return "all";
  });
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Sidebar deep-links must apply even when the page is already mounted —
  // useState initializers above run only once, so sync tab + filters from the URL.
  useEffect(() => {
    if (urlTab === "submeter" || (urlTab === "bills" && methodParam === "submeter")) {
      setActiveTab("bills");
      setMethodFilter("submeter");
    } else if (urlTab === "bills" && methodParam === "rubs") {
      setActiveTab("bills");
      setMethodFilter("rubs");
    } else if (urlTab === "unpaid" || (urlTab === "bills" && statusParam === "unpaid")) {
      setActiveTab("bills");
      setStatusFilter("unpaid");
    } else {
      setActiveTab(urlTab);
      setMethodFilter("all");
      setStatusFilter("all");
    }
  }, [urlTab, methodParam, statusParam]);

  // Same source as /properties — the dropdown always matches the portfolio list
  const { data: propertiesData } = useQuery({
    queryKey: ["properties", "all"],
    queryFn: () => getProperties({ limit: "100" }),
    retry: 1,
  });
  const propertyNames: string[] = (propertiesData?.data || []).map(
    (p: any) => p.name,
  );

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReadingModal, setShowReadingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState<WaterBill | null>(null);

  // Form states for new bill
  const [newBillMethod, setNewBillMethod] = useState<"submeter" | "rubs">("submeter");
  const [newProperty, setNewProperty] = useState("");
  const [newUnit, setNewUnit] = useState("Unit 201");
  const [newTenant, setNewTenant] = useState("Maria Santos");
  const [newPrevReading, setNewPrevReading] = useState("150.0");
  const [newCurrReading, setNewCurrReading] = useState("165.5");
  const [newRubsOccupants, setNewRubsOccupants] = useState("2");
  const [newDueDate, setNewDueDate] = useState("2026-10-30");

  // Form states for payment
  const [payMethod, setPayMethod] = useState("Bank Transfer");

  // Form states for meter reading
  const [newReadingUnit, setNewReadingUnit] = useState("Unit 105");
  const [newReadingMeter, setNewReadingMeter] = useState("WM-CV-105");
  const [newReadingPrev, setNewReadingPrev] = useState("88.0");
  const [newReadingCurr, setNewReadingCurr] = useState("99.4");

  // RUBS Calculator state
  const [masterBillAmount, setMasterBillAmount] = useState<number>(1250);
  const [rubsAllocationMethod, setRubsAllocationMethod] = useState<"occupants" | "sqft">("occupants");

  // Rate settings state
  const [baseRate, setBaseRate] = useState<number>(2.85);
  const [baseServiceFee, setBaseServiceFee] = useState<number>(15.0);
  const [sewerSurchargePct, setSewerSurchargePct] = useState<number>(15);

  // Handlers write to Supabase via the water adapter, then refresh the
  // cached lists (same invalidate pattern as the other ported pages).
  const invalidateWater = () => {
    queryClient.invalidateQueries({ queryKey: ["water", "bills"] });
    queryClient.invalidateQueries({ queryKey: ["water", "readings"] });
  };

  // Sync tab change with URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Filtered bills calculation
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      if (propertyFilter !== "all" && b.property !== propertyFilter) return false;
      if (methodFilter !== "all" && b.method !== methodFilter) return false;
      if (statusFilter === "unpaid" && b.status === "paid") return false;
      if (statusFilter !== "all" && statusFilter !== "unpaid" && b.status !== statusFilter) return false;
      if (periodFilter !== "all" && b.billingPeriod !== periodFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match =
          b.billNumber.toLowerCase().includes(term) ||
          b.tenant.toLowerCase().includes(term) ||
          b.unit.toLowerCase().includes(term);
        if (!match) return false;
      }
      return true;
    });
  }, [bills, propertyFilter, methodFilter, statusFilter, periodFilter, searchTerm]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalBilled = bills.reduce((acc, b) => acc + b.totalAmount, 0);
    const totalPaid = bills
      .filter((b) => b.status === "paid")
      .reduce((acc, b) => acc + b.totalAmount, 0);
    const totalOutstanding = bills
      .filter((b) => b.status !== "paid")
      .reduce((acc, b) => acc + b.totalAmount, 0);
    const totalConsumption = bills.reduce((acc, b) => acc + (b.consumption || 0), 0);
    return { totalBilled, totalPaid, totalOutstanding, totalConsumption };
  }, [bills]);

  // Create Bill handler
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    let total = 0;
    let consumption = 0;
    const prev = parseFloat(newPrevReading) || 0;
    const curr = parseFloat(newCurrReading) || 0;

    if (newBillMethod === "submeter") {
      consumption = Math.max(0, curr - prev);
      const waterCost = consumption * baseRate;
      const sewerCost = waterCost * (sewerSurchargePct / 100);
      total = waterCost + sewerCost + baseServiceFee;
    } else {
      const occupants = parseInt(newRubsOccupants) || 1;
      total = (masterBillAmount / 20) * occupants;
    }

    const bill: NewWaterBillInput = {
      billNumber: `WB-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      property: newProperty || propertyNames[0] || "",
      unit: newUnit,
      tenant: newTenant,
      method: newBillMethod,
      previousReading: newBillMethod === "submeter" ? prev : undefined,
      currentReading: newBillMethod === "submeter" ? curr : undefined,
      consumption: newBillMethod === "submeter" ? Math.round(consumption * 10) / 10 : undefined,
      rubsFactor:
        newBillMethod === "rubs"
          ? `${newRubsOccupants} Occupants (RUBS split)`
          : undefined,
      ratePerUnit: baseRate,
      baseCharge: baseServiceFee,
      sewerFee: Math.round(total * 0.15 * 100) / 100,
      totalAmount: Math.round(total * 100) / 100,
      billingPeriod: "Oct 2026",
      dueDate: newDueDate,
    };

    try {
      await createWaterBill(bill);
      invalidateWater();
      setShowCreateModal(false);
      toast.success("Water bill generated");
    } catch (err) {
      toast.error(apiError(err, "Failed to create water bill"));
    }
  };

  // Add Meter Reading handler
  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault();
    const prev = parseFloat(newReadingPrev) || 0;
    const curr = parseFloat(newReadingCurr) || 0;
    const diff = Math.max(0, curr - prev);

    try {
      await createWaterReading({
        meterId: newReadingMeter,
        property: propertyNames[0] || "",
        unit: newReadingUnit,
        tenant: "Tenant",
        previousReading: prev,
        currentReading: curr,
        consumption: Math.round(diff * 10) / 10,
        readingDate: new Date().toISOString().split("T")[0],
        readerName: "Staff On-Duty",
        leakWarning: diff > 30,
      });
      invalidateWater();
      setShowReadingModal(false);
      toast.success("Meter reading logged");
    } catch (err) {
      toast.error(apiError(err, "Failed to log meter reading"));
    }
  };

  // Mark Bill Paid handler
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPaymentModal) return;

    try {
      await markWaterBillPaid(showPaymentModal.id, payMethod);
      invalidateWater();
      setShowPaymentModal(null);
      toast.success("Water payment recorded");
    } catch (err) {
      toast.error(apiError(err, "Failed to record payment"));
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-page)] pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <PageHeader
            title="Water Transactions & Billing"
            subtitle="Industry-standard submetering, RUBS utility allocation, and tenant water ledger"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReadingModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors shadow-sm"
            >
              <Gauge size={16} className="text-[#003580]" />
              <span>Log Reading</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-[#003580] text-white hover:bg-[#002860] transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span>New Water Bill</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Billed"
            value={formatCurrency(stats.totalBilled)}
            sub="Current billing cycle"
            icon={<Receipt size={20} />}
          />
          <StatCard
            label="Total Collected"
            value={formatCurrency(stats.totalPaid)}
            sub="Settled water payments"
            icon={<CheckCircle2 size={20} className="text-emerald-600" />}
            color="text-emerald-600"
          />
          <StatCard
            label="Outstanding Balance"
            value={formatCurrency(stats.totalOutstanding)}
            sub="Pending and overdue bills"
            icon={<AlertTriangle size={20} className="text-amber-600" />}
            color="text-amber-600"
          />
          <StatCard
            label="Total Consumption"
            value={`${stats.totalConsumption.toFixed(1)} m³`}
            sub="Submetered water usage"
            icon={<Droplets size={20} className="text-cyan-600" />}
            color="text-cyan-600"
          />
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[var(--border-color)] mb-6">
          <nav className="flex space-x-6 overflow-x-auto pb-px">
            {[
              { id: "bills", label: "Water Bills", icon: Receipt },
              { id: "readings", label: "Meter Readings", icon: Gauge },
              { id: "rubs", label: "RUBS Calculator", icon: Calculator },
              { id: "payments", label: "Payment Ledger", icon: CreditCard },
              { id: "tariffs", label: "Rates & Tariffs", icon: SlidersHorizontal },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                    active
                      ? "border-[#003580] text-[#003580]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]"
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* ================= TAB: WATER BILLS ================= */}
        {activeTab === "bills" && (
          <div className="space-y-4">
            {/* Dropdown Filters & Search Bar */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-4 shadow-[var(--shadow-sm)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative">
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  />
                  <input
                    type="text"
                    placeholder="Search tenant, unit, bill #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  />
                </div>

                {/* Property Dropdown */}
                <div>
                  <select
                    value={propertyFilter}
                    onChange={(e) => setPropertyFilter(e.target.value)}
                    aria-label="Filter by Property"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  >
                    <option value="all">All Properties</option>
                    {propertyNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Billing Method Dropdown */}
                <div>
                  <select
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value)}
                    aria-label="Filter by Billing Method"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  >
                    <option value="all">All Billing Methods</option>
                    <option value="submeter">Submetered (Actual m³)</option>
                    <option value="rubs">RUBS (Ratio Allocation)</option>
                  </select>
                </div>

                {/* Status Dropdown */}
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by Payment Status"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                    <option value="unpaid">Unpaid (Pending + Overdue)</option>
                  </select>
                </div>

                {/* Billing Period Dropdown */}
                <div>
                  <select
                    value={periodFilter}
                    onChange={(e) => setPeriodFilter(e.target.value)}
                    aria-label="Filter by Billing Period"
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  >
                    <option value="all">All Billing Periods</option>
                    <option value="Oct 2026">October 2026</option>
                    <option value="Sep 2026">September 2026</option>
                    <option value="Aug 2026">August 2026</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Bills Table */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-color)]">
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Bill #
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Property & Unit
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Tenant
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Method
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Usage / Ratio
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Amount Due
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Due Date
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Status
                      </th>
                      <th className="text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredBills.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-[var(--text-muted)] text-sm">
                          No water billing transactions match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredBills.map((b) => (
                        <tr
                          key={b.id}
                          className="hover:bg-[var(--bg-muted)]/50 transition-colors duration-150"
                        >
                          <td className="px-5 py-4 text-sm font-semibold text-[#003580]">
                            {b.billNumber}
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-[var(--text-primary)]">
                              {b.unit}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{b.property}</p>
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--text-primary)]">
                            {b.tenant}
                          </td>
                          <td className="px-5 py-4">
                            {b.method === "submeter" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                <Gauge size={11} /> Submeter
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                                <Calculator size={11} /> RUBS
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {b.method === "submeter" ? (
                              <div>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {b.consumption} m³
                                </span>
                                <span className="text-xs text-[var(--text-muted)] block">
                                  ({b.previousReading} → {b.currentReading})
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-[var(--text-secondary)]">
                                {b.rubsFactor}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-[var(--text-primary)]">
                            {formatCurrency(b.totalAmount)}
                          </td>
                          <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                            {formatDate(b.dueDate)}
                          </td>
                          <td className="px-5 py-4">
                            <Badge status={b.status} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            {b.status !== "paid" ? (
                              <button
                                onClick={() => setShowPaymentModal(b)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#003580] text-white hover:bg-[#002860] transition-colors"
                              >
                                <DollarSign size={12} />
                                Pay
                              </button>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">
                                Paid via {b.paymentMethod || "Direct"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: METER READINGS ================= */}
        {activeTab === "readings" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  Submeter Usage & Readings
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Automated and manual water meter reading logs with automated leak detection
                </p>
              </div>
              <button
                onClick={() => setShowReadingModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#003580] text-white hover:bg-[#002860] transition-colors"
              >
                <Plus size={14} /> Log Reading
              </button>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-color)]">
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Meter Serial #
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Unit & Property
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Previous (m³)
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Current (m³)
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Net Usage
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Date Logged
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Logged By
                      </th>
                      <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                        Leak Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {readings.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--bg-muted)]/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-semibold text-[#003580]">
                          {r.meterId}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {r.unit}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{r.property}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                          {r.previousReading}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[var(--text-primary)]">
                          {r.currentReading}
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-cyan-700 dark:text-cyan-400">
                          {r.consumption} m³
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                          {formatDate(r.readingDate)}
                        </td>
                        <td className="px-5 py-4 text-xs text-[var(--text-muted)]">
                          {r.readerName}
                        </td>
                        <td className="px-5 py-4">
                          {r.leakWarning ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                              <AlertTriangle size={12} /> High Usage Alert
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 size={12} /> Normal
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: RUBS CALCULATOR ================= */}
        {activeTab === "rubs" && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 shadow-[var(--shadow-sm)]">
              <div className="max-w-2xl">
                <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                  RUBS (Ratio Utility Billing System) Formula Engine
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-6">
                  When buildings do not have physical submeters installed for each unit, RUBS divides
                  the master utility bill proportionally across tenants by legal allocation criteria.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Master Utility Water Bill ($)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={masterBillAmount}
                        onChange={(e) => setMasterBillAmount(parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Allocation Factor
                    </label>
                    <select
                      value={rubsAllocationMethod}
                      onChange={(e) =>
                        setRubsAllocationMethod(e.target.value as "occupants" | "sqft")
                      }
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                    >
                      <option value="occupants">By Resident Occupancy Count</option>
                      <option value="sqft">By Unit Square Footage (Sq. Ft.)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-[var(--bg-muted)] border border-[var(--border-color)]">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Formula Breakdown:
                  </p>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                    {rubsAllocationMethod === "occupants"
                      ? `Tenant Share = (Tenant Occupants / Total Building Occupants) × $${masterBillAmount.toFixed(2)}`
                      : `Tenant Share = (Unit Sq Ft / Total Rentable Sq Ft) × $${masterBillAmount.toFixed(2)}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Simulated Allocation Table */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-5">
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-3">
                Calculated Unit Proportions
              </h4>
              <div className="space-y-2">
                {[
                  { unit: "Unit 101", occupants: 2, sqft: 750, ratio: "10.0%" },
                  { unit: "Unit 102", occupants: 3, sqft: 950, ratio: "15.0%" },
                  { unit: "Unit 201", occupants: 1, sqft: 500, ratio: "5.0%" },
                  { unit: "Unit 202", occupants: 4, sqft: 1200, ratio: "20.0%" },
                ].map((row) => {
                  const sharePct = parseFloat(row.ratio) / 100;
                  const calculatedAmount = masterBillAmount * sharePct;
                  return (
                    <div
                      key={row.unit}
                      className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-muted)]/60 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <Building size={16} className="text-[#003580]" />
                        <div>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {row.unit}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] ml-2">
                            ({row.occupants} Occupants • {row.sqft} sq ft)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-[var(--text-secondary)]">
                          Ratio: {row.ratio}
                        </span>
                        <span className="font-bold text-[#003580]">
                          {formatCurrency(calculatedAmount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB: PAYMENT LEDGER ================= */}
        {activeTab === "payments" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                Water Payment Transactions
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Audit trail of settled water utility charges and payment receipts
              </p>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-[var(--shadow-sm)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-muted)] border-b border-[var(--border-color)]">
                    <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                      Payment Date
                    </th>
                    <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                      Bill Reference
                    </th>
                    <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                      Tenant / Unit
                    </th>
                    <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                      Amount Paid
                    </th>
                    <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                      Payment Channel
                    </th>
                    <th className="text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider px-5 py-3.5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {bills
                    .filter((b) => b.status === "paid")
                    .map((b) => (
                      <tr key={b.id} className="hover:bg-[var(--bg-muted)]/50 transition-colors">
                        <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                          {b.paymentDate ? formatDate(b.paymentDate) : "—"}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-[#003580]">
                          {b.billNumber}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-[var(--text-primary)]">
                            {b.tenant}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">{b.unit}</p>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(b.totalAmount)}
                        </td>
                        <td className="px-5 py-4 text-sm text-[var(--text-secondary)]">
                          {b.paymentMethod || "Direct Transfer"}
                        </td>
                        <td className="px-5 py-4">
                          <Badge status="paid" />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB: TARIFFS & RATES ================= */}
        {activeTab === "tariffs" && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6 shadow-[var(--shadow-sm)] max-w-2xl">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">
              Municipal Utility Rate & Tariff Setup
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Configure baseline water unit rates, sewer surcharges, and fixed administrative fees applied to tenant statements.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Base Water Rate ($ per m³)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={baseRate}
                  onChange={(e) => setBaseRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Fixed Meter Service Fee ($ / month)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={baseServiceFee}
                  onChange={(e) => setBaseServiceFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Municipal Sewer / Environmental Surcharge (%)
                </label>
                <input
                  type="number"
                  value={sewerSurchargePct}
                  onChange={(e) => setSewerSurchargePct(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => alert("Rate schedule updated successfully.")}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#003580] text-white hover:bg-[#002860] transition-colors"
                >
                  Save Tariff Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL: CREATE WATER BILL ================= */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-4">
                <div className="flex items-center gap-2">
                  <Droplets className="text-[#003580]" size={20} />
                  <h3 className="font-bold text-lg text-[var(--text-primary)]">
                    Generate New Water Bill
                  </h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBill} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Billing Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewBillMethod("submeter")}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                        newBillMethod === "submeter"
                          ? "bg-[#003580] text-white border-[#003580]"
                          : "border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                      }`}
                    >
                      Submetered (Actual m³)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBillMethod("rubs")}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors ${
                        newBillMethod === "rubs"
                          ? "bg-[#003580] text-white border-[#003580]"
                          : "border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                      }`}
                    >
                      RUBS Ratio Formula
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Property
                    </label>
                    <select
                      value={newProperty || propertyNames[0] || ""}
                      onChange={(e) => setNewProperty(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                    >
                      {propertyNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tenant Name
                  </label>
                  <input
                    type="text"
                    value={newTenant}
                    onChange={(e) => setNewTenant(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  />
                </div>

                {newBillMethod === "submeter" ? (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[var(--bg-muted)]">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Previous Reading (m³)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newPrevReading}
                        onChange={(e) => setNewPrevReading(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Current Reading (m³)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newCurrReading}
                        onChange={(e) => setNewCurrReading(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[var(--bg-muted)]">
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Resident Occupants
                    </label>
                    <input
                      type="number"
                      value={newRubsOccupants}
                      onChange={(e) => setNewRubsOccupants(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#003580] text-white hover:bg-[#002860] shadow-sm"
                  >
                    Generate Bill
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: RECORD PAYMENT ================= */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-4">
                <h3 className="font-bold text-lg text-[var(--text-primary)]">
                  Record Water Payment
                </h3>
                <button
                  onClick={() => setShowPaymentModal(null)}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleRecordPayment} className="space-y-4">
                <div className="p-3 rounded-lg bg-[var(--bg-muted)] space-y-1 text-sm">
                  <p className="text-[var(--text-muted)] text-xs">
                    Bill #{showPaymentModal.billNumber}
                  </p>
                  <p className="font-semibold text-[var(--text-primary)]">
                    {showPaymentModal.tenant} ({showPaymentModal.unit})
                  </p>
                  <p className="text-xl font-bold text-[#003580] mt-2">
                    {formatCurrency(showPaymentModal.totalAmount)}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Payment Method
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#003580]"
                  >
                    <option value="Bank Transfer">Bank Transfer / ACH</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                    <option value="Cash">Cash at Office</option>
                    <option value="Online Portal">Resident Online Portal</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(null)}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#003580] text-white hover:bg-[#002860] shadow-sm"
                  >
                    Confirm Payment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL: LOG METER READING ================= */}
        {showReadingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-color)] mb-4">
                <div className="flex items-center gap-2">
                  <Gauge className="text-[#003580]" size={20} />
                  <h3 className="font-bold text-lg text-[var(--text-primary)]">
                    Log Submeter Reading
                  </h3>
                </div>
                <button
                  onClick={() => setShowReadingModal(false)}
                  className="p-1 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)]"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddReading} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Meter Serial ID
                  </label>
                  <input
                    type="text"
                    value={newReadingMeter}
                    onChange={(e) => setNewReadingMeter(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newReadingUnit}
                    onChange={(e) => setNewReadingUnit(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Previous Reading (m³)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newReadingPrev}
                      onChange={(e) => setNewReadingPrev(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Current Reading (m³)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={newReadingCurr}
                      onChange={(e) => setNewReadingCurr(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setShowReadingModal(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#003580] text-white hover:bg-[#002860] shadow-sm"
                  >
                    Save Reading
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
