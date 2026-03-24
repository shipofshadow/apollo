import { Link } from 'react-router-dom';
import { AlertTriangle, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-brand-dark border border-gray-800 rounded-sm">
        <AlertTriangle className="w-10 h-10 text-brand-orange" />
      </div>

      <p className="text-brand-orange font-bold uppercase tracking-widest text-sm mb-3">
        Error 404
      </p>

      <h1 className="text-6xl md:text-8xl font-display font-black text-white uppercase tracking-tighter mb-4">
        Page Not <span className="text-brand-orange">Found</span>
      </h1>

      <p className="text-gray-400 max-w-md mx-auto text-lg mb-10">
        The page you're looking for doesn't exist or has been moved. Let's get you back on the road.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
        >
          <Home className="w-4 h-4" /> Back to Home
        </Link>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 border border-gray-700 text-gray-400 px-8 py-3 font-bold uppercase tracking-widest hover:border-gray-500 hover:text-white transition-colors rounded-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    </div>
  );
}
