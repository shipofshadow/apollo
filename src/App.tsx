import { Provider } from 'react-redux';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { store } from './store';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import ServicesPage from './pages/ServicesPage';
import ServiceDetail from './pages/ServiceDetail';
import About from './pages/About';
import BookingPage from './pages/BookingPage';
import Admin from './pages/Admin';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Portfolio from './pages/Portfolio';

export default function App() {
  return (
    <Provider store={store}>
      <Router>
        <div className="min-h-screen bg-brand-dark font-sans text-brand-light selection:bg-brand-orange selection:text-white flex flex-col">
          <Header />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/services/:id" element={<ServiceDetail />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/about" element={<About />} />
              <Route path="/booking" element={<BookingPage />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </Provider>
  );
}
