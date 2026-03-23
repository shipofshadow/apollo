import ServicesGrid from '../components/ServicesGrid';

export default function ServicesPage() {
  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6 mb-16 text-center">
        <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-4">
          Our Offerings
        </span>
        <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tighter mb-8">
          Products & <span className="text-brand-orange">Services</span>
        </h1>
        <p className="text-gray-400 max-w-3xl mx-auto text-lg leading-relaxed">
          From custom lighting to advanced security systems, we provide top-tier automotive upgrades. Explore our full range of services below.
        </p>
      </div>

      <ServicesGrid />

      {/* Products Section */}
      <div className="container mx-auto px-4 md:px-6 mt-32">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Shop Parts
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            Featured <span className="text-brand-orange">Products</span>
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { name: 'RGB Demon Eyes Kit', price: '$149.99', img: 'https://images.unsplash.com/photo-1584345611124-287a5085e648?q=80&w=2015&auto=format&fit=crop' },
            { name: '10.1" Android Headunit', price: '$499.99', img: 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop' },
            { name: 'Sequential LED Halos', price: '$199.99', img: 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?q=80&w=2069&auto=format&fit=crop' },
            { name: '2-Way Paging Alarm', price: '$299.99', img: 'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?q=80&w=2070&auto=format&fit=crop' },
          ].map((product, idx) => (
            <div key={idx} className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden group">
              <div className="aspect-square bg-asphalt overflow-hidden">
                <img 
                  src={product.img} 
                  alt={product.name} 
                  className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-6">
                <h3 className="text-white font-bold uppercase tracking-wider mb-2">{product.name}</h3>
                <p className="text-brand-orange font-display text-xl font-bold">{product.price}</p>
                <button className="w-full mt-4 bg-transparent border border-gray-600 text-white font-bold uppercase tracking-widest text-xs py-3 hover:bg-brand-orange hover:border-brand-orange transition-colors">
                  Add to Cart
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
