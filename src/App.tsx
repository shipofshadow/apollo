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

// Public pages
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ServiceDetail from './pages/ServiceDetail';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Portfolio from './pages/Portfolio';
import About from './pages/About';
import BookingPage from './pages/BookingPage';
import Blog from './pages/Blog';
import FaqPage from './pages/Faq';
import NotFoundPage from './pages/NotFoundPage';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Client portal
import ClientLayout from './pages/client/ClientLayout';
import ClientDashboard from './pages/client/ClientDashboard';
import MyBookings from './pages/client/MyBookings';
import BookingDetail from './pages/client/BookingDetail';
import Profile from './pages/client/Profile';

// Admin
import Admin from './pages/Admin';

/** Wraps public-facing routes with the site Header and Footer. */
function PublicLayout() {
  return (
    <div className="min-h-screen bg-brand-dark font-sans text-brand-light selection:bg-brand-orange selection:text-white flex flex-col">
      <Header />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
    </div>
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
            <Routes>

              {/* ── Public website — has Header + Footer ────────────── */}
              <Route element={<PublicLayout />}>
                <Route path="/"             element={<Home />} />
                <Route path="/services"     element={<ServicesPage />} />
                <Route path="/services/:slug" element={<ServiceDetail />} />
                <Route path="/products"     element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/portfolio"    element={<Portfolio />} />
                <Route path="/blog"         element={<Blog />} />
                <Route path="/faq"          element={<FaqPage />} />
                <Route path="/about"        element={<About />} />
                <Route path="/booking"      element={<BookingPage />} />
                <Route path="/login"        element={<LoginPage />} />
                <Route path="/register"     element={<RegisterPage />} />
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
                <Route path="profile"       element={<Profile />} />
              </Route>

              {/* ── Admin — own sidebar, no public nav ──────────────── */}
              <Route path="/admin" element={<Admin />} />

            </Routes>
          </AuthProvider>
        </ToastProvider>
      </Router>
    </Provider>
  );
}
