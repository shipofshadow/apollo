import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import BeforeAfterShowcase from '../components/BeforeAfterShowcase';
import { fetchBuildShowcaseApi } from '../services/api';

export default function BuildShowcase() {
  const { slug } = useParams();

  const [build, setBuild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    fetchBuildShowcaseApi(slug)
      .then(data => setBuild(data))
      .catch(() => setError('Not found'))
      .finally(() => setLoading(false));
  }, [slug]);


  if (loading) return <div className="text-center py-20 text-gray-400">Loading…</div>;
  if (error || !build) return <div className="text-center py-20 text-red-400">Build not found.</div>;

  return (
    <div className="min-h-screen bg-brand-dark py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-display font-black text-white mb-2 uppercase tracking-tight">{build.title}</h1>
        <p className="text-gray-400 mb-6">{build.description}</p>
        <div className="mb-8">
          {build.images && build.images.length >= 2 ? (
            <BeforeAfterShowcase
              cases={[{
                id: build.id,
                title: build.title,
                beforeUrl: build.images[0],
                afterUrl: build.images[1],
                description: build.description,
              }]}
            />
          ) : (
            <div className="text-gray-500">No before/after images available.</div>
          )}
        </div>
        {build.parts && build.parts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-2">Installed Parts</h2>
            <ul className="list-disc list-inside text-gray-300">
              {build.parts.map((part: string, i: number) => <li key={i}>{part}</li>)}
            </ul>
          </div>
        )}
        <button
          className="bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-widest rounded-sm hover:bg-orange-600 transition-colors"
          onClick={() => navigator.clipboard.writeText(window.location.href)}
        >
          Share this build
        </button>
      </div>
    </div>
  );
}
