import { ThumbsUp, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';

const posts = [
  {
    id: 1,
    author: '1625 Auto Lab',
    time: '2 hours ago',
    content: 'Just finished this insane quad projector retrofit on a 2020 WRX STI. Full RGB demon eyes, sequential halos, and custom etched lenses. The output on these is absolutely ridiculous! 🚗💨🔥 #1625AutoLab #Retrofit #WRXSTI',
    image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1964&auto=format&fit=crop',
    likes: 245,
    comments: 32,
  },
  {
    id: 2,
    author: '1625 Auto Lab',
    time: 'Yesterday at 4:30 PM',
    content: 'We are now offering custom 3D printed bezels for all Android Headunit installations! Get that factory-finish look with modern tech. DM us to book your slot. 🛠️📱',
    image: 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop',
    likes: 189,
    comments: 14,
  },
  {
    id: 3,
    author: '1625 Auto Lab',
    time: 'March 14 at 10:15 AM',
    content: 'Another happy customer! Upgraded the lighting on this Tacoma TRD for those late-night off-road trails. Stay safe out there! 🏕️🔦',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=2070&auto=format&fit=crop',
    likes: 312,
    comments: 45,
  }
];

export default function FacebookFeed() {
  return (
    <section className="py-24 bg-brand-darker border-t border-gray-800">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Social Updates
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            Latest from <span className="text-brand-orange">The Lab</span>
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <div key={post.id} className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden flex flex-col">
              {/* Post Header */}
              <div className="p-4 flex items-center justify-between border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-orange rounded-full flex items-center justify-center font-display font-bold text-white">
                    1625
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">{post.author}</h4>
                    <span className="text-gray-500 text-xs">{post.time}</span>
                  </div>
                </div>
                <button className="text-gray-500 hover:text-white transition-colors">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>

              {/* Post Content */}
              <div className="p-4 flex-grow">
                <p className="text-gray-300 text-sm leading-relaxed">
                  {post.content}
                </p>
              </div>

              {/* Post Image */}
              <div className="w-full aspect-video bg-brand-gray">
                <img 
                  src={post.image} 
                  alt="Post attachment" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Post Stats & Actions */}
              <div className="p-4 bg-brand-darker/50">
                <div className="flex items-center justify-between text-gray-400 text-xs mb-3 pb-3 border-b border-gray-800">
                  <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-brand-orange" /> {post.likes}</span>
                  <span>{post.comments} Comments</span>
                </div>
                <div className="flex items-center justify-between">
                  <button className="flex items-center gap-1 sm:gap-2 text-gray-400 hover:text-brand-orange transition-colors text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <ThumbsUp className="w-4 h-4" /> <span className="hidden sm:inline">Like</span>
                  </button>
                  <button className="flex items-center gap-1 sm:gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <MessageCircle className="w-4 h-4" /> <span className="hidden sm:inline">Comment</span>
                  </button>
                  <button className="flex items-center gap-1 sm:gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm font-bold uppercase tracking-wider">
                    <Share2 className="w-4 h-4" /> <span className="hidden sm:inline">Share</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
