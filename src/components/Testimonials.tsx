import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Star, Loader2 } from 'lucide-react';
import { fetchTestimonialsAsync } from '../store/siteSettingsSlice';
import type { AppDispatch, RootState } from '../store';

export default function Testimonials() {
  const dispatch = useDispatch<AppDispatch>();
  const { testimonials, status } = useSelector((s: RootState) => s.siteSettings);

  useEffect(() => {
    dispatch(fetchTestimonialsAsync(null));
  }, [dispatch]);

  if (status === 'loading' && testimonials.length === 0) {
    return (
      <section className="py-24 bg-brand-darker">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      </section>
    );
  }

  if (testimonials.length === 0) return null;

  return (
    <section className="py-24 bg-brand-darker relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Client Feedback
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            What Our <span className="text-brand-orange">Clients Say</span>
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-brand-dark border border-gray-800 p-8 rounded-sm hover:border-brand-orange/50 transition-colors duration-300 flex flex-col h-full"
            >
              <div className="flex items-center gap-4 mb-6">
                {testimonial.imageUrl ? (
                  <img
                    src={testimonial.imageUrl}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-gray-800"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0">
                    <span className="text-brand-orange font-black text-xl uppercase">
                      {testimonial.name[0]}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-white font-bold text-lg">{testimonial.name}</h3>
                  <p className="text-brand-orange text-sm font-bold uppercase tracking-widest">{testimonial.role}</p>
                </div>
              </div>

              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-brand-orange text-brand-orange" />
                ))}
              </div>

              <p className="text-gray-400 italic leading-relaxed flex-grow">
                "{testimonial.content}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
