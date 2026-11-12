import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
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
const MfaScreen = lazy(() => import("@/features/auth/Auth").then((m) => ({ default: m.MfaScreen })));
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
const Support = lazy(() => import("@/features/dashboard/Support"));
const TicketThread = lazy(() => import("@/features/dashboard/Support").then((m) => ({ default: m.TicketThread })));
const Shop = lazy(() => import("@/features/shop/Shop"));
const Unsubscribe = lazy(() => import("@/features/auth/Unsubscribe"));
const ProductPage = lazy(() => import("@/features/shop/Shop").then((m) => ({ default: m.ProductPage })));
const Checkout = lazy(() => import("@/features/shop/Shop").then((m) => ({ default: m.Checkout })));
const OrderConfirmed = lazy(() => import("@/features/shop/Shop").then((m) => ({ default: m.OrderConfirmed })));
const GuestGuide = lazy(() => import("@/features/guide/GuestGuide"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  // Accounts with two-step verification must enter their code, however they signed in (password, Google, Apple).
  const [aal, setAal] = useState<"checking" | "ok" | "need">("checking");
  useEffect(() => {
    if (!user) return;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) =>
      setAal(data && data.nextLevel === "aal2" && data.currentLevel !== "aal2" ? "need" : "ok"));
  }, [user]);
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (aal === "checking") return <PageLoader />;
  if (aal === "need") return <Suspense fallback={<PageLoader />}><MfaScreen onDone={() => setAal("ok")} /></Suspense>;
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
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/checkout" element={<Checkout />} />
              <Route path="/shop/order/:number" element={<OrderConfirmed />} />
              <Route path="/shop/:slug" element={<ProductPage />} />
              <Route path="/app/welcome" element={<RequireAuth><Onboarding /></RequireAuth>} />
              <Route path="/app" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
                <Route index element={<Dashboard />} />
                <Route path="properties" element={<Properties />} />
                <Route path="properties/:id" element={<PropertyDetails />} />
                <Route path="screens" element={<Screens />} />
                <Route path="guide" element={<Guide />} />
                <Route path="insights" element={<Insights />} />
                <Route path="support" element={<Support />} />
                <Route path="support/:id" element={<TicketThread />} />
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
