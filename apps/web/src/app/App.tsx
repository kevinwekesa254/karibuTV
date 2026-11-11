import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { PageLoader } from "@/components/ui";

const Landing = lazy(() => import("@/features/landing/Landing"));
const Privacy = lazy(() => import("@/features/legal/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("@/features/legal/Legal").then((m) => ({ default: m.Terms })));
const SignIn = lazy(() => import("@/features/auth/Auth").then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => import("@/features/auth/Auth").then((m) => ({ default: m.SignUp })));
const Reset = lazy(() => import("@/features/auth/Auth").then((m) => ({ default: m.Reset })));
const ConfirmReset = lazy(() => import("@/features/auth/Auth").then((m) => ({ default: m.ConfirmReset })));
const DashboardLayout = lazy(() => import("@/features/dashboard/Layout"));
const Dashboard = lazy(() => import("@/features/dashboard/Dashboard"));
const Onboarding = lazy(() => import("@/features/dashboard/Onboarding"));
const Properties = lazy(() => import("@/features/dashboard/Properties"));
const PropertyDetails = lazy(() => import("@/features/dashboard/Properties").then((m) => ({ default: m.PropertyDetails })));
const Screens = lazy(() => import("@/features/dashboard/Screens"));
const Wifi = lazy(() => import("@/features/dashboard/Wifi"));
const Rules = lazy(() => import("@/features/dashboard/Rules"));
const Integrations = lazy(() => import("@/features/dashboard/Integrations"));
const Bookings = lazy(() => import("@/features/dashboard/Bookings"));
const Tvs = lazy(() => import("@/features/dashboard/Tvs"));
const Billing = lazy(() => import("@/features/dashboard/Billing"));
const Settings = lazy(() => import("@/features/dashboard/Settings"));
const More = lazy(() => import("@/features/dashboard/More"));
const TvRoute = lazy(() => import("@/features/tv/TvRoute"));
const Guide = lazy(() => import("@/features/dashboard/Guide"));
const Insights = lazy(() => import("@/features/dashboard/Insights"));
const AdminLayout = lazy(() => import("@/features/admin/Admin"));
const GuestGuide = lazy(() => import("@/features/guide/GuestGuide"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function TvPairRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/app/tvs${search}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/signin" element={<GuestOnly><SignIn /></GuestOnly>} />
              <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
              <Route path="/reset" element={<Reset />} />
              <Route path="/reset/new" element={<ConfirmReset />} />
              <Route path="/tv" element={<TvRoute />} />
              <Route path="/g/:id" element={<GuestGuide />} />
              <Route path="/app/welcome" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/app" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
                <Route index element={<Dashboard />} />
                <Route path="properties" element={<Properties />} />
                <Route path="properties/:id" element={<PropertyDetails />} />
                <Route path="screens" element={<Screens />} />
                <Route path="guide" element={<Guide />} />
                <Route path="insights" element={<Insights />} />
                <Route path="wifi" element={<Wifi />} />
                <Route path="rules" element={<Rules />} />
                <Route path="integrations" element={<Integrations />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="tvs" element={<Tvs />} />
                <Route path="tvs/pair" element={<TvPairRedirect />} />
                <Route path="billing" element={<Billing />} />
                <Route path="settings" element={<Settings />} />
                <Route path="more" element={<More />} />
              </Route>
              <Route path="/admin/*" element={<RequireAuth><AdminLayout /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
