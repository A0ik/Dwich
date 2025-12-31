import { useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Clock, Mail, Send, CheckCircle } from 'lucide-react';
import { RESTAURANT_INFO } from '../utils/helpers';

export default function Contact() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    setFormSubmitted(true);
    setFormData({ name: '', email: '', subject: '', message: '' });
    setTimeout(() => setFormSubmitted(false), 5000);
  };

  // Formater les horaires pour l'affichage
  const hoursFormatted = Object.entries(RESTAURANT_INFO.hours)
    .map(([day, hours]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours}`)
    .join('\n');
  
  const contactInfo = [
    {
      icon: MapPin,
      title: 'Adresse',
      content: RESTAURANT_INFO.address,
      link: RESTAURANT_INFO.googleMapsUrl,
    },
    {
      icon: Phone,
      title: 'Téléphone',
      content: RESTAURANT_INFO.phone,
      link: `tel:${RESTAURANT_INFO.phone.replace(/\s/g, '')}`,
    },
    {
      icon: Mail,
      title: 'Email',
      content: RESTAURANT_INFO.email,
      link: `mailto:${RESTAURANT_INFO.email}`,
    },
    {
      icon: Clock,
      title: 'Horaires',
      content: hoursFormatted,
    },
  ];
  
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white mb-4">
            Nous <span className="text-gradient">contacter</span>
          </h1>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Une question, une suggestion ou simplement envie de nous dire bonjour ? N'hésitez pas !
          </p>
        </motion.div>
        
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-2xl font-bold text-white mb-8">Informations</h2>
            
            <div className="grid sm:grid-cols-2 gap-6 mb-12">
              {contactInfo.map((info, index) => (
                <motion.div
                  key={info.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
                  whileHover={{ y: -5 }}
                  className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-emerald-500/30 transition-all"
                >
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                    <info.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{info.title}</h3>
                  {info.link ? (
                    <a
                      href={info.link}
                      target={info.link.startsWith('http') ? '_blank' : undefined}
                      rel={info.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                      className="text-white/60 hover:text-emerald-400 transition-colors whitespace-pre-line text-sm"
                    >
                      {info.content}
                    </a>
                  ) : (
                    <p className="text-white/60 whitespace-pre-line text-sm">{info.content}</p>
                  )}
                </motion.div>
              ))}
            </div>
            
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-white/5">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2532.8!2d2.78!3d50.42!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47dd30e5f3c4c9c7%3A0x4c2c6d6c6d6c6d6c!2s135%20Rue%20Jules%20Guesde%2C%2062800%20Li%C3%A9vin!5e0!3m2!1sfr!2sfr!4v1704067200000"
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'grayscale(1) invert(0.9) contrast(1.1)' }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-2xl font-bold text-white mb-8">Envoyez-nous un message</h2>
            
            {formSubmitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Message envoyé !</h3>
                <p className="text-white/60">Nous vous répondrons dans les plus brefs délais.</p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white/60 text-sm mb-2">Nom</label>
                    <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="input" placeholder="Votre nom" />
                  </div>
                  <div>
                    <label className="block text-white/60 text-sm mb-2">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="input" placeholder="votre@email.com" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-white/60 text-sm mb-2">Sujet</label>
                  <input type="text" name="subject" value={formData.subject} onChange={handleInputChange} required className="input" placeholder="Sujet de votre message" />
                </div>
                
                <div>
                  <label className="block text-white/60 text-sm mb-2">Message</label>
                  <textarea name="message" value={formData.message} onChange={handleInputChange} required rows={6} className="input resize-none" placeholder="Votre message..." />
                </div>
                
                <motion.button type="submit" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full bg-gradient-emerald text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30">
                  <Send className="w-5 h-5" /><span>Envoyer le message</span>
                </motion.button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
