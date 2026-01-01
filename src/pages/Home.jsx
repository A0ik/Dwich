import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Clock, Star, Utensils, Flame, Truck } from 'lucide-react';
import { menuData } from '../data/menu';
import Testimonials from '../components/Testimonials';
import MapCard from '../components/MapCard';

export default function Home() {
  const featuredCategories = menuData.categories.slice(0, 4);
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/50 via-black to-black" />
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1920&q=80')] bg-cover bg-center opacity-20" />
          <motion.div animate={{ x: [0, 30, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity }} className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px]" />
          <motion.div animate={{ x: [0, -20, 0], y: [0, 30, 0] }} transition={{ duration: 10, repeat: Infinity }} className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full blur-[100px]" />
        </div>
        
        <div className="absolute inset-0 grid-pattern opacity-50" />
        
        <div className="container mx-auto px-4 relative z-10 pt-20">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-8">
              <Flame className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">Street Food Premium et Halal</span>
            </motion.div>
            
            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-tight mb-6">
              Dwich{' '}<span className="text-gradient">62</span>
            </motion.h1>
            
            <motion.p initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="text-xl md:text-2xl text-white/60 max-w-2xl mx-auto mb-10">
              Tacos, burgers, kebabs... Des saveurs authentiques préparées avec passion et des ingrédients frais.
            </motion.p>
            
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/menu">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary text-lg px-8 py-4 flex items-center gap-2">
                  <Utensils className="w-5 h-5" /><span>Voir le menu</span><ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              <Link to="/contact">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-secondary text-lg px-8 py-4">Nous trouver</motion.button>
              </Link>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} className="flex flex-wrap items-center justify-center gap-8 md:gap-12 mt-16 pt-16 border-t border-white/10">
              {[
                { value: '50K+', label: 'Clients satisfaits' },
                { value: '4.8', label: 'Note moyenne', icon: Star },
                { value: '30min', label: 'Temps de préparation' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {stat.icon && <stat.icon className="w-5 h-5 text-emerald-400 fill-emerald-400" />}
                    <span className="text-3xl md:text-4xl font-bold text-white">{stat.value}</span>
                  </div>
                  <span className="text-white/50 text-sm">{stat.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
        
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <motion.div animate={{ y: [0, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
            <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1 h-2 bg-emerald-400 rounded-full" />
          </motion.div>
        </motion.div>
      </section>
      
      {/* Categories Preview */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">Notre carte</span>
            <h2 className="text-4xl md:text-5xl font-bold text-white mt-3">Explorez nos catégories</h2>
          </motion.div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCategories.map((category, index) => (
              <motion.div key={category.slug} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }}>
                <Link to={`/menu#${category.slug}`}>
                  <motion.div whileHover={{ y: -10 }} className="relative aspect-[4/5] rounded-3xl overflow-hidden group cursor-pointer">
                    <img src={category.image} alt={category.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                    <div className="absolute inset-0 p-6 flex flex-col justify-end">
                      <span className="text-4xl mb-3">{category.emoji}</span>
                      <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">{category.name}</h3>
                      <p className="text-white/60 text-sm mt-2">{category.products.length} produit{category.products.length > 1 ? 's' : ''}</p>
                      <motion.div initial={{ opacity: 0, x: -10 }} whileHover={{ opacity: 1, x: 0 }} className="absolute bottom-6 right-6 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                        <ArrowRight className="w-5 h-5 text-white" />
                      </motion.div>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </div>
          
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-12">
            <Link to="/menu">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-secondary inline-flex items-center gap-2">
                <span>Voir tout le menu</span><ArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <Testimonials />
      
      {/* Features Section */}
      <section className="py-24 relative border-t border-white/5">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Utensils, title: 'Produits frais', description: 'Tous nos ingrédients sont sélectionnés chaque jour pour garantir une qualité optimale.' },
              { icon: Truck, title: 'Livraison rapide', description: 'Commandez en ligne et faites-vous livrer en 30 minutes dans un rayon de 5km.' },
              { icon: Clock, title: 'Ouvert 7j/7', description: 'De 11h à 23h en semaine, et de 12h à 22h le dimanche.' },
            ].map((feature, index) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.1 }} className="text-center p-8">
                <motion.div whileHover={{ scale: 1.1, rotate: 5 }} className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-white/50">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0">
              <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=80" alt="Food" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
            </div>
            <div className="relative p-8 md:p-16 lg:p-24 max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Une envie de saveurs ?</h2>
              <p className="text-white/60 text-lg mb-8">Commandez dès maintenant et profitez de nos délicieuses spécialités. Retrait sur place ou livraison disponible.</p>
              <div className="flex flex-wrap gap-4">
                <Link to="/menu">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary text-lg">Commander maintenant</motion.button>
                </Link>
                <div className="flex items-center gap-2 text-white/60">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  <span>135 Ter Rue Jules Guesde, 62800 Liévin</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Map Card Section */}
      <MapCard />
    </div>
  );
}
