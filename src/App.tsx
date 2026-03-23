import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import { AuthProvider } from './context/AuthContext';
import ScrollToTop from './components/ScrollToTop';
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

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Client portal
import ClientLayout from './pages/client/ClientLayout';
import ClientDashboard from './pages/client/ClientDashboard';
import MyBookings from './pages/client/MyBookings';
import Profile from './pages/client/Profile';

// Admin
import Admin from './pages/Admin';

export default function App() {
  return (
    <Provider store={store}>
      <Router>
        {/* AuthProvider lives inside Router (uses no Router APIs itself)
            and inside Redux Provider (it reads from the Redux store) */}
        <AuthProvider>
          <ScrollToTop />
          <div className="min-h-screen bg-brand-dark font-sans text-brand-light selection:bg-brand-orange selection:text-white flex flex-col">
            <Header />
            <main className="flex-grow">
              <Routes>
                {/* ── Public ─────────────────────────────────────── */}
                <Route path="/"              element={<Home />} />
                <Route path="/services"      element={<ServicesPage />} />
                <Route path="/services/:id"  element={<ServiceDetail />} />
                <Route path="/products"      element={<Products />} />
                <Route path="/products/:id"  element={<ProductDetail />} />
                <Route path="/portfolio"     element={<Portfolio />} />
                <Route path="/blog"          element={<Blog />} />
                <Route path="/about"         element={<About />} />
                <Route path="/booking"       element={<BookingPage />} />

                {/* ── Auth ───────────────────────────────────────── */}
                <Route path="/login"    element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* ── Client portal (requires auth) ──────────────── */}
                <Route
                  path="/client"
                  element={
                    <ProtectedRoute requiredRole="client">
                      <ClientLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<ClientDashboard />} />
                  <Route path="bookings"  element={<MyBookings />} />
                  <Route path="profile"   element={<Profile />} />
                </Route>

                {/* ── Admin ──────────────────────────────────────── */}
                <Route path="/admin" element={<Admin />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </Router>
    </Provider>
  );
}

