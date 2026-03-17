import { ArrowRight, ChevronRight } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0 bg-asphalt">
        <img
          src="https://images.unsplash.com/photo-1584345611124-287a5085e648?q=80&w=2015&auto=format&fit=crop"
          alt="Dark automotive garage"
          className="w-full h-full object-cover object-center mix-blend-overlay opacity-40"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-darker/95 via-brand-darker/80 to-transparent"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Text Content */}
        <div className="space-y-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-orange/10 border border-brand-orange/30 rounded-full">
            <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse"></span>
            <span className="text-brand-orange text-xs font-bold uppercase tracking-widest">
              Premium Auto Retrofitting
            </span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-display font-black leading-[0.85] text-brand-orange text-outline-thick uppercase tracking-tighter">
            1625 <br />
            <span className="text-white text-outline-none tracking-tight">
              AUTOLAB
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-lg leading-relaxed border-l-4 border-brand-orange pl-4">
            Specializing in custom headlight retrofits, android headunits, and performance electronics. We don't just fix cars; we upgrade them.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <a
              href="#services"
              className="group relative inline-flex items-center justify-center gap-2 bg-brand-orange text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm overflow-hidden transition-all hover:shadow-[0_0_30px_rgba(255,106,0,0.4)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Explore Services <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
            </a>
            
            <a
              href="#contact"
              className="group inline-flex items-center justify-center gap-2 bg-transparent border border-gray-600 text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm hover:border-white hover:bg-white/5 transition-all"
            >
              Book The Lab <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-brand-dark to-transparent z-10"></div>
      <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/3 opacity-5 pointer-events-none">
        <span className="font-display text-[20rem] font-bold leading-none text-white whitespace-nowrap">
          1625
        </span>
      </div>
    </section>
  );
}
