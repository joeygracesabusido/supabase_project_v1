import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/ui/ThemeProvider";
import { Layout } from "./components/layout/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { TenantsPage } from "./pages/TenantsPage";
import { BillingPage } from "./pages/BillingPage";
import { UnitsPage } from "./pages/UnitsPage";
import { ListingsPage } from "./pages/ListingsPage";
import { LeasesPage } from "./pages/LeasesPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { InspectionsPage } from "./pages/InspectionsPage";
import { InspectionDetailPage } from "./pages/InspectionDetailPage";
import { InspectionComparePage } from "./pages/InspectionComparePage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { SalesPage } from "./pages/SalesPage";
import { SaleDetailPage } from "./pages/SaleDetailPage";
import { ItemFinancingPage } from "./pages/ItemFinancingPage";
import { ItemFinancingDetailPage } from "./pages/ItemFinancingDetailPage";
import { ItemFinancingPaymentsPage } from "./pages/ItemFinancingPaymentsPage";
import { WaterTransactionsPage } from "./pages/WaterTransactionsPage";
import { ApprovalsPage } from "./pages/ApprovalsPage";
import { UsersPage } from "./pages/UsersPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { getCurrentUser } from "./lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<{ loading: boolean; user?: unknown }>({
    loading: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        setAuthState({ loading: false, user });
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  if (authState.loading) return null;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider>
          <Toaster richColors position="top-right" />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/properties" element={<PropertiesPage />} />
                <Route path="/units" element={<UnitsPage />} />
                <Route path="/listings" element={<ListingsPage />} />
                <Route path="/tenants" element={<TenantsPage />} />
                <Route path="/leases" element={<LeasesPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="/inspections" element={<InspectionsPage />} />
                <Route path="/inspections/compare/:leaseId" element={<InspectionComparePage />} />
                <Route path="/inspections/:id" element={<InspectionDetailPage />} />
                <Route path="/maintenance" element={<MaintenancePage />} />
                <Route path="/sales" element={<SalesPage />} />
                <Route path="/sales/:id" element={<SaleDetailPage />} />
                <Route path="/item-financing" element={<ItemFinancingPage />} />
                <Route path="/item-financing/payments" element={<ItemFinancingPaymentsPage />} />
                <Route path="/item-financing/:id" element={<ItemFinancingDetailPage />} />
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/approvals" element={<ApprovalsPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/water" element={<WaterTransactionsPage />} />
                <Route path="/water/bills" element={<WaterTransactionsPage defaultTab="bills" />} />
                <Route path="/water/readings" element={<WaterTransactionsPage defaultTab="readings" />} />
                <Route path="/water/rubs" element={<WaterTransactionsPage defaultTab="rubs" />} />
                <Route path="/water/payments" element={<WaterTransactionsPage defaultTab="payments" />} />
                <Route path="/water/tariffs" element={<WaterTransactionsPage defaultTab="tariffs" />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
