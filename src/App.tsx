import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { store } from './store';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ScrollToTop from './components/ScrollToTop';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import Header from './components/Header';
import Footer from './components/Footer';
import WebsiteChatWidget from './components/chatbot/WebsiteChatWidget';
import { useNotificationPoller } from './hooks/useNotificationPoller';

// Public pages
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ServiceDetail from './pages/ServiceDetail';
import ProductDetail from './pages/ProductDetail';
import Portfolio from './pages/Portfolio';
import About from './pages/About';
import BookingPage from './pages/BookingPage';
import Blog from './pages/Blog';
import FaqPage from './pages/Faq';
import ContactPage from './pages/Contact';
import NotFoundPage from './pages/NotFoundPage';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Client portal
import ClientLayout from './pages/client/ClientLayout';
import ClientDashboard from './pages/client/ClientDashboard';
import MyBookings from './pages/client/MyBookings';
import BookingDetail from './pages/client/BookingDetail';
import MyGarage from './pages/client/MyGarage';
import Profile from './pages/client/Profile';


// Admin
import Admin from './pages/Admin';

// Build Showcase (public build mini-site)
import BuildShowcase from './pages/BuildShowcase';

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
    <Routes>

      {/* ── Public website — has Header + Footer ────────────── */}
      <Route element={<PublicLayout />}>
        <Route path="/"             element={<Home />} />
        <Route path="/services"     element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServiceDetail />} />
        <Route path="/products"     element={<Navigate to="/services" replace />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/portfolio"    element={<Portfolio />} />
        <Route path="/builds/:slug" element={<BuildShowcase />} />
        <Route path="/blog"         element={<Blog />} />
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
        <Route path="garage"        element={<MyGarage />} />
        <Route path="profile"       element={<Profile />} />
      </Route>

      {/* ── Admin — own sidebar, no public nav ──────────────── */}
      <Route path="/admin/*" element={<Admin />} />

    </Routes>
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
