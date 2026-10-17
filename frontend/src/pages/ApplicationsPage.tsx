import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  AlertCircle,
  UserPlus,
  Plus,
  X,
  Mail,
  Phone,
  Briefcase,
  Building2,
  CalendarDays,
  Users,
  MapPin,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  getApplications,
  updateApplicationStatus,
  convertApplication,
  type RentalApplication,
} from "../api/applications";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Pagination } from "../components/ui/Pagination";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { AddApplicationModal } from "../components/applications/AddApplicationModal";
import { formatDate } from "../lib/utils";

const STATUS_TABS = [
  { value: "", label: "All Applications" },
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "converted", label: "Converted" },
];

export function ApplicationsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState<RentalApplication | null>(null);
  const [convertTarget, setConvertTarget] = useState<RentalApplication | null>(
    null,
  );
  const queryClient = useQueryClient();
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["applications", statusFilter, page],
    queryFn: () =>
      getApplications({
        page: String(page),
        limit: String(limit),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    retry: 1,
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: string;
      reason?: string;
    }) =>
      updateApplicationStatus(
        id,
        status as Parameters<typeof updateApplicationStatus>[1],
        reason,
      ),
    onSuccess: (app) => {
      toast.success(`Application ${app.status}`);
      setDetail(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: unknown) =>
      toast.error(
        err instanceof Error ? err.message : "Failed to update application",
      ),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) => convertApplication(id),
    onSuccess: (result) => {
      toast.success(
        `${result.tenant.name} is now a tenant — create a lease to finish move-in`,
      );
      setConvertTarget(null);
      setDetail(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (err: unknown) => {
      setConvertTarget(null);
      toast.error(
        err instanceof Error ? err.message : "Failed to convert application",
      );
    },
  });

  const applications: RentalApplication[] = data?.data || [];
  const pagination = data?.pagination || { page, total: 0, total_pages: 0 };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Applications"
          subtitle={`${pagination.total || 0} rental applications`}
          action={
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#003580] hover:bg-[#002d6c] rounded-lg transition-colors shadow-sm"
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Application
            </button>
          }
        />

        {/* Filter Tabs */}
        <div
          className="mb-6 p-1 rounded-lg inline-flex gap-1 overflow-x-auto"
          style={{ backgroundColor: "var(--bg-muted)" }}
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap"
              style={{
                backgroundColor:
                  statusFilter === tab.value ? "#003580" : "transparent",
                color:
                  statusFilter === tab.value ? "#ffffff" : "var(--text-secondary)",
                boxShadow:
                  statusFilter === tab.value ? "var(--shadow-sm)" : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-5 animate-pulse"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-color)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full"
                    style={{ backgroundColor: "var(--bg-muted)" }}
                  />
                  <div className="flex-1 space-y-2">
                    <div
                      className="h-4 w-32 rounded"
                      style={{ backgroundColor: "var(--bg-muted)" }}
                    />
                    <div
                      className="h-3 w-48 rounded"
                      style={{ backgroundColor: "var(--bg-muted)" }}
                    />
                  </div>
                  <div
                    className="h-6 w-20 rounded-full"
                    style={{ backgroundColor: "var(--bg-muted)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div
            className="text-center py-16 rounded-lg"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <AlertCircle
              size={48}
              className="mx-auto mb-4"
              style={{ color: "#CC0000" }}
            />
            <p
              className="font-semibold text-lg mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Failed to load applications
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Please check your connection and try again.
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: "#003580" }}
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
        ) : applications.length === 0 ? (
          <div
            className="text-center py-16 rounded-lg"
            style={{ backgroundColor: "var(--bg-card)" }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: "var(--bg-muted)" }}
            >
              <Inbox size={32} style={{ color: "var(--text-muted)" }} />
            </div>
            <p
              className="font-semibold text-lg mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              No applications found
            </p>
            <p className="text-sm max-w-md mx-auto mb-5" style={{ color: "var(--text-secondary)" }}>
              Applications submitted on your public listings will appear here.
              Share your listings to start receiving applications — or record a
              walk-in application manually.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: "#003580" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#00224F")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#003580")
              }
            >
              <Plus size={16} strokeWidth={2.5} />
              Add Application
            </button>
          </div>
        ) : (
          <>
            {/* Application Cards */}
            <div className="space-y-3">
              {applications.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  onClick={() => setDetail(app)}
                />
              ))}
            </div>

            <div className="mt-6">
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

      {/* Add Modal */}
      {showAdd && (
        <AddApplicationModal
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            toast.success("Application recorded");
            queryClient.invalidateQueries({ queryKey: ["applications"] });
          }}
        />
      )}

      {/* Detail Modal */}
      {detail && (
        <ApplicationDetailModal
          application={detail}
          onClose={() => setDetail(null)}
          onStatus={(status, reason) =>
            statusMutation.mutate({ id: detail.id, status, reason })
          }
          onConvert={() => setConvertTarget(detail)}
        />
      )}

      <ConfirmDialog
        open={!!convertTarget}
        title="Convert to tenant?"
        message={`${convertTarget?.applicant_name} will be added to your tenants. You can then create a lease for them.`}
        confirmLabel="Convert"
        onConfirm={() =>
          convertTarget && convertMutation.mutate(convertTarget.id)
        }
        onCancel={() => setConvertTarget(null)}
      />
    </div>
  );
}

function ApplicationCard({
  application: a,
  onClick,
}: {
  application: RentalApplication;
  onClick: () => void;
}) {
  return (
    <div
      className="group rounded-lg p-5 cursor-pointer transition-all hover:scale-[1.005]"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
        e.currentTarget.style.borderColor = "#0071C2";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
        e.currentTarget.style.borderColor = "var(--border-color)";
      }}
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-lg"
          style={{ backgroundColor: "#003580" }}
        >
          {a.applicant_name?.charAt(0)?.toUpperCase() || "?"}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3
                className="font-semibold text-base truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {a.applicant_name}
              </h3>
              <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
                {a.email}
              </p>
            </div>
            <Badge status={a.status} />
          </div>

          {/* Property & Details */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {a.listing?.title && (
              <div className="flex items-center gap-1.5">
                <Building2 size={14} style={{ color: "#0071C2" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {a.listing.title}
                </span>
                {a.listing.unit && (
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    · {a.listing.unit.unit_number}
                  </span>
                )}
              </div>
            )}

            {a.monthly_income && (
              <div className="flex items-center gap-1.5">
                <Briefcase size={14} style={{ color: "#008009" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  ₱{Number(a.monthly_income).toLocaleString()}/mo
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <CalendarDays size={14} style={{ color: "var(--text-muted)" }} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {formatDate(a.created_at)}
              </span>
            </div>

            {a.listing?.unit?.properties?.name && (
              <div className="flex items-center gap-1.5">
                <MapPin size={14} style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {a.listing.unit.properties.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight
          size={20}
          className="flex-shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          style={{ color: "var(--text-muted)" }}
        />
      </div>
    </div>
  );
}

function ApplicationDetailModal({
  application: a,
  onClose,
  onStatus,
  onConvert,
}: {
  application: RentalApplication;
  onClose: () => void;
  onStatus: (status: string, reason?: string) => void;
  onConvert: () => void;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const reviewable = !["converted", "withdrawn"].includes(a.status);

  const field = (
    icon: React.ReactNode,
    label: string,
    value?: string | number | null,
  ) => (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: "var(--bg-muted)" }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {value || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl"
        style={{
          backgroundColor: "var(--bg-card)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{
            borderBottom: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-muted)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ backgroundColor: "#003580" }}
            >
              {a.applicant_name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <h2
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)" }}
              >
                {a.applicant_name}
              </h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Applied {formatDate(a.created_at)} ·{" "}
                {a.listing?.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-muted)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Status Banner */}
          <div className="mb-5">
            <Badge status={a.status} />
          </div>

          {/* Fields Grid */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            {field(
              <Mail size={16} style={{ color: "var(--text-secondary)" }} />,
              "Email",
              a.email,
            )}
            {field(
              <Phone size={16} style={{ color: "var(--text-secondary)" }} />,
              "Phone",
              a.phone,
            )}
            {field(
              <Briefcase size={16} style={{ color: "var(--text-secondary)" }} />,
              "Employment",
              a.employment_status,
            )}
            {field(
              <Building2 size={16} style={{ color: "var(--text-secondary)" }} />,
              "Employer",
              a.employer,
            )}
            {field(
              <Briefcase size={16} style={{ color: "#008009" }} />,
              "Monthly Income",
              a.monthly_income
                ? `₱${Number(a.monthly_income).toLocaleString()}`
                : null,
            )}
            {field(
              <Users size={16} style={{ color: "var(--text-secondary)" }} />,
              "Occupants",
              a.occupants,
            )}
            {field(
              <CalendarDays size={16} style={{ color: "var(--text-secondary)" }} />,
              "Desired Move-in",
              a.desired_move_in
                ? formatDate(a.desired_move_in)
                : null,
            )}
            {field(
              <MapPin size={16} style={{ color: "var(--text-secondary)" }} />,
              "Current Address",
              a.current_address,
            )}
          </div>

          {/* Message */}
          {a.message && (
            <div
              className="rounded-lg p-4 mb-5"
              style={{ backgroundColor: "var(--bg-muted)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} style={{ color: "#0071C2" }} />
                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Applicant Message
                </p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                {a.message}
              </p>
            </div>
          )}

          {/* Rejection Reason */}
          {a.status === "rejected" && a.rejection_reason && (
            <div
              className="rounded-lg p-4 mb-5"
              style={{
                backgroundColor: "#FEF2F2",
                border: "1px solid #FECACA",
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: "#CC0000" }}
              >
                Rejection Reason
              </p>
              <p className="text-sm" style={{ color: "#991B1B" }}>
                {a.rejection_reason}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {reviewable && (
          <div
            className="px-6 py-4"
            style={{
              borderTop: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-muted)",
            }}
          >
            {showReject ? (
              <div className="space-y-3">
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  rows={3}
                    className="w-full px-4 py-3 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#CC0000]/20"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                    color: "var(--text-primary)",
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowReject(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      color: "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-card)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    Back
                  </button>
                  <button
                    onClick={() =>
                      onStatus("rejected", rejectReason || undefined)
                    }
                    className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                    style={{ backgroundColor: "#CC0000" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#990000")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#CC0000")
                    }
                  >
                    Confirm Rejection
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                {a.status === "pending" && (
                  <button
                    onClick={() => onStatus("reviewing")}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                    style={{
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-card)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    Mark Reviewing
                  </button>
                )}
                {a.status !== "approved" && (
                  <button
                    onClick={() => onStatus("approved")}
                    className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                    style={{ backgroundColor: "#008009" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#006607")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#008009")
                    }
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => setShowReject(true)}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{
                    border: "1px solid #FECACA",
                    color: "#CC0000",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#FEF2F2";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  Reject
                </button>
                {a.status === "approved" && (
                  <button
                    onClick={onConvert}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                    style={{ backgroundColor: "#003580" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "#00224F")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "#003580")
                    }
                  >
                    <UserPlus size={16} />
                    Convert to Tenant
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
