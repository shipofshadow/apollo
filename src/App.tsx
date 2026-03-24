import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
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
        <AuthProvider>
          <ScrollToTop />
          <Routes>

            {/* ── Public website — has Header + Footer ────────────── */}
            <Route element={<PublicLayout />}>
              <Route path="/"             element={<Home />} />
              <Route path="/services"     element={<ServicesPage />} />
              <Route path="/services/:id" element={<ServiceDetail />} />
              <Route path="/products"     element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/portfolio"    element={<Portfolio />} />
              <Route path="/blog"         element={<Blog />} />
              <Route path="/about"        element={<About />} />
              <Route path="/booking"      element={<BookingPage />} />
              <Route path="/login"        element={<LoginPage />} />
              <Route path="/register"     element={<RegisterPage />} />
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
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="bookings"  element={<MyBookings />} />
              <Route path="profile"   element={<Profile />} />
            </Route>

            {/* ── Admin — own sidebar, no public nav ──────────────── */}
            <Route path="/admin" element={<Admin />} />

          </Routes>
        </AuthProvider>
      </Router>
    </Provider>
  );
}



