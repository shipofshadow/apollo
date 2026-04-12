import { Suspense, lazy } from 'react';
import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { store } from './store';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ScrollToTop from './components/ScrollToTop';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import AppErrorBoundary from './components/AppErrorBoundary';
import WebsiteChatWidget from './components/chatbot/WebsiteChatWidget';
import { useNotificationPoller } from './hooks/useNotificationPoller';

const Home = lazy(() => import('./pages/Home'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const Products = lazy(() => import('./pages/Products'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const About = lazy(() => import('./pages/About'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogPostDetail = lazy(() => import('./pages/BlogPostDetail'));
const FaqPage = lazy(() => import('./pages/Faq'));
const ContactPage = lazy(() => import('./pages/Contact'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const ClientLayout = lazy(() => import('./pages/client/ClientLayout'));
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const MyBookings = lazy(() => import('./pages/client/MyBookings'));
const BookingDetail = lazy(() => import('./pages/client/BookingDetail'));
const MyGarage = lazy(() => import('./pages/client/MyGarage'));
const Profile = lazy(() => import('./pages/client/Profile'));
const MyOrders = lazy(() => import('./pages/client/MyOrders'));
const OrderReceiptPage = lazy(() => import('./pages/OrderReceiptPage'));
const Admin = lazy(() => import('./pages/Admin'));
const BuildShowcase = lazy(() => import('./pages/BuildShowcase'));

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
      <div className="w-9 h-9 rounded-full border-2 border-gray-700 border-t-brand-orange animate-spin" />
      <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading…</span>
    </div>
  );
}

/** Wraps public-facing routes with the site Header and Footer. */
function PublicLayout() {
  return (
    <div className="min-h-screen bg-brand-dark font-sans text-brand-light selection:bg-brand-orange selection:text-white flex flex-col">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <WebsiteChatWidget />
      <Footer />
    </div>
  );
}

/** Inner component so hooks can access the Redux store. */
function AppInner() {
  useNotificationPoller();

  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>

      {/* ── Public website — has Header + Footer ────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/"             element={<Home />} />
        <Route path="/services"     element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServiceDetail />} />
        <Route path="/products"     element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cart"         element={<CartPage />} />
        <Route path="/checkout"     element={<CheckoutPage />} />
        <Route path="/portfolio"    element={<Portfolio />} />
        <Route path="/builds/:slug" element={<BuildShowcase />} />
        <Route path="/blog"         element={<Blog />} />
        <Route path="/blog/:id"     element={<BlogPostDetail />} />
        <Route path="/faq"          element={<FaqPage />} />
        <Route path="/contact"      element={<ContactPage />} />
        <Route path="/about"        element={<About />} />
        <Route path="/booking"      element={<BookingPage />} />
        <Route path="/login"             element={<LoginPage />} />
        <Route path="/register"          element={<RegisterPage />} />
        <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
        <Route path="/reset-password"    element={<ResetPasswordPage />} />
        <Route path="*"             element={<NotFoundPage />} />
      </Route>

      {/* ── Client portal — own sidebar, no public nav ──────── */}
      <Route
        path="/client"
        element={
          <ProtectedRoute requiredRole="client">
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard"     element={<ClientDashboard />} />
        <Route path="bookings"      element={<MyBookings />} />
        <Route path="bookings/:id"  element={<BookingDetail />} />
        <Route path="orders"        element={<MyOrders />} />
        <Route path="garage"        element={<MyGarage />} />
        <Route path="profile"       element={<Profile />} />
      </Route>

      {/* ── Admin — own sidebar, no public nav ──────────────── */}
      <Route path="/admin/*" element={<Admin />} />

      {/* ── Order receipt — auth required, no header/footer ─── */}
      <Route
        path="/orders/:id/receipt"
        element={
          <ProtectedRoute>
            <OrderReceiptPage />
          </ProtectedRoute>
        }
      />

      {/* ── Chatbot standalone pages — protected (staff+) ────── */}
      <Route
        path="/chatbot/conversations"
        element={
          <ProtectedRoute denyClientRole>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chatbot/flow-editor"
        element={
          <ProtectedRoute denyClientRole>
            <Admin />
          </ProtectedRoute>
        }
      />

        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <Router>
        <ToastProvider>
          <AuthProvider>
            <ScrollToTop />
            <ToastContainer />
            <AppInner />
          </AuthProvider>
        </ToastProvider>
      </Router>
    </Provider>
  );
}
