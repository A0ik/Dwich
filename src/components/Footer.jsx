import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Instagram, Facebook, Mail } from 'lucide-react';
import { RESTAURANT_INFO } from '../utils/helpers';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="relative bg-black/50 border-t border-white/5 pt-16 pb-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>
      
      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div>
            <Link to="/" className="inline-block mb-6">
              <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3">
                <img src="/logo.jpg" alt="Dwich 62" className="w-12 h-12 rounded-xl object-cover" />
                <span className="font-bold text-2xl tracking-tight">DWICH<span className="text-emerald-400">62</span></span>
              </motion.div>
            </Link>
            <p className="text-white/50 text-sm leading-relaxed">
              La meilleure street food du 62. Tacos, burgers, kebabs et plus encore, préparés avec passion.
            </p>
          </div>
          
          {/* Horaires */}
          <div>
            <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-400" />Horaires
            </h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(RESTAURANT_INFO.hours).map(([day, hours]) => (
                <li key={day} className="flex justify-between">
                  <span className="text-white/50 capitalize">{day}</span>
                  <span className="text-white/70">{hours}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-white mb-6">Contact</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <a href={RESTAURANT_INFO.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-emerald-400 transition-colors text-sm">
                  {RESTAURANT_INFO.address}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <a href={`tel:${RESTAURANT_INFO.phone.replace(/\s/g, '')}`} className="text-white/50 hover:text-emerald-400 transition-colors text-sm">
                  {RESTAURANT_INFO.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <a href={`mailto:${RESTAURANT_INFO.email}`} className="text-white/50 hover:text-emerald-400 transition-colors text-sm">
                  {RESTAURANT_INFO.email}
                </a>
              </li>
            </ul>
          </div>
          
          {/* Social & Navigation */}
          <div>
            <h3 className="font-semibold text-white mb-6">Suivez-nous</h3>
            <div className="flex gap-3 mb-6">
              {[{ icon: Instagram, href: '#', label: 'Instagram' }, { icon: Facebook, href: '#', label: 'Facebook' }].map((social) => (
                <motion.a key={social.label} href={social.href} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all" aria-label={social.label}>
                  <social.icon className="w-5 h-5 text-white/70" />
                </motion.a>
              ))}
            </div>
            <h3 className="font-semibold text-white mb-4 mt-6">Navigation</h3>
            <ul className="space-y-2">
              {[{ to: '/', label: 'Accueil' }, { to: '/menu', label: 'Notre Menu' }, { to: '/contact', label: 'Contact' }].map((link) => (
                <li key={link.to}><Link to={link.to} className="text-white/50 hover:text-emerald-400 transition-colors text-sm">{link.label}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/5 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-sm">© {currentYear} DWICH62. Tous droits réservés.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/30 hover:text-white/50 transition-colors text-sm">Mentions légales</a>
              <a href="#" className="text-white/30 hover:text-white/50 transition-colors text-sm">CGV</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
