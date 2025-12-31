import { useState, useMemo, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, CreditCard, MapPin, Phone, User, Mail, 
  Clock, Truck, Store, Lock, Banknote
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatPrice, formatSelectedOptions, generateOrderId } from '../utils/helpers';
import { DELIVERY_FEE } from '../utils/constants';
import TicketConfirmation from '../components/TicketConfirmation';
import { useToast } from '../components/Toast';

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, totalPrice, clearCart, openCart } = useCart();
  const toast = useToast();
  const [orderType, setOrderType] = useState('delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    notes: '',
  });
  
  // Vérifier si on revient de Stripe avec succès
  const stripeSuccess = searchParams.get('success') === 'true';
  const stripeSessionId = searchParams.get('session_id');
  const stripeCanceled = searchParams.get('canceled') === 'true';

  // Si paiement annulé: retour menu + panier ouvert (sans toucher au panier)
  useEffect(() => {
    if (!stripeCanceled) return;
    toast.error("Commande annulée. Aucun paiement n'a été effectué.");
    navigate('/menu', { replace: true });
    // Petit délai pour laisser React Router afficher /menu avant d'ouvrir le drawer
    setTimeout(() => openCart(), 50);
  }, [stripeCanceled, toast, navigate, openCart]);
  
  // Si paiement réussi: récupérer les détails depuis Stripe
  useEffect(() => {
    if (!stripeSuccess || !stripeSessionId || orderSuccess) return;
    
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/get-checkout-session?session_id=${stripeSessionId}`);
        const session = await response.json();
        
        if (session.error) {
          console.error('Error fetching session:', session.error);
          // Fallback: utiliser le session_id comme numéro de commande
          setOrderSuccess({
            id: stripeSessionId.slice(-8).toUpperCase(),
            orderType: 'delivery',
            total: 0,
            paymentMethod: 'stripe',
          });
        } else {
          setOrderSuccess({
            id: stripeSessionId.slice(-8).toUpperCase(),
            orderType: session.metadata?.orderType || 'delivery',
            total: session.amount_total || 0,
            paymentMethod: 'stripe',
            customerName: session.metadata?.customerName,
          });
        }
        clearCart();
      } catch (error) {
        console.error('Error:', error);
        setOrderSuccess({
          id: stripeSessionId.slice(-8).toUpperCase(),
          orderType: 'delivery',
          total: 0,
          paymentMethod: 'stripe',
        });
        clearCart();
      }
    };
    
    fetchSession();
  }, [stripeSuccess, stripeSessionId, orderSuccess, clearCart]);

  // Calcul du total avec frais de livraison
  const deliveryFee = orderType === 'delivery' ? DELIVERY_FEE : 0;
  const finalTotal = totalPrice + deliveryFee;
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const isFormValid = useMemo(() => {
    const baseValid = formData.firstName && formData.lastName && formData.email && formData.phone;
    if (orderType === 'delivery') {
      return baseValid && formData.address && formData.city && formData.postalCode;
    }
    return baseValid;
  }, [formData, orderType]);
  
  const handleStripePayment = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            name: item.productName,
            description: formatSelectedOptions(item.selectedOptions, item.optionGroups),
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
          deliveryFee: DELIVERY_FEE,
          customerInfo: formData,
          orderType: 'delivery',
        }),
      });
      const { url, error } = await response.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (error) {
      console.error('Erreur Stripe:', error);
      toast.error('Erreur de paiement. Veuillez réessayer.');
      setIsSubmitting(false);
    }
  };
  
  const handlePickupOrder = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/create-pickup-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            name: item.productName,
            description: formatSelectedOptions(item.selectedOptions, item.optionGroups),
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          })),
          customerInfo: formData,
          orderType: 'pickup',
          totalAmount: finalTotal,
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Succès - afficher le ticket
      setOrderSuccess({
        id: data.orderId,
        orderType: 'pickup',
        total: finalTotal,
        paymentMethod: 'on_site',
        customer: formData,
      });
      clearCart();
      
    } catch (error) {
      console.error('Erreur commande:', error);
      toast.error('Erreur lors de la commande. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (items.length === 0 && !orderSuccess && !stripeSuccess) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-10 h-10 text-white/30" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Votre panier est vide</h2>
            <p className="text-white/50 mb-8">Ajoutez des produits à votre panier avant de passer commande.</p>
            <Link to="/menu"><motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn-primary">Voir le menu</motion.button></Link>
          </motion.div>
        </div>
      </div>
    );
  }
  
  if (orderSuccess) {
    return (
      <div className="min-h-screen pt-32 pb-20">
        <div className="container mx-auto px-4">
          <TicketConfirmation
            ticketId={orderSuccess.id}
            amount={orderSuccess.total}
            date={new Date()}
            cardHolder={orderSuccess.customer ? `${orderSuccess.customer.firstName} ${orderSuccess.customer.lastName}` : 'Client'}
            last4Digits="****"
            orderType={orderSuccess.orderType}
          />
          <div className="max-w-sm mx-auto mt-8 space-y-4">
            <div className="bg-white/5 rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
                <Clock className="w-4 h-4" />
                <span>Temps estimé: <strong className="text-white">25-35 min</strong></span>
              </div>
            </div>
            <div className="flex gap-4">
              <Link to="/menu" className="flex-1"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary w-full">Nouvelle commande</motion.button></Link>
              <Link to="/" className="flex-1"><motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-secondary w-full">Accueil</motion.button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4">
        <motion.button initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-5 h-5" /><span>Retour</span>
        </motion.button>
        
        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-8">Finaliser la commande</h1>
            
            <form onSubmit={orderType === 'delivery' ? handleStripePayment : handlePickupOrder} className="space-y-8">
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Mode de commande</h2>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setOrderType('delivery')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-start gap-2 ${orderType === 'delivery' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2">
                      <Truck className={`w-5 h-5 ${orderType === 'delivery' ? 'text-emerald-400' : 'text-white/50'}`} />
                      <span className={orderType === 'delivery' ? 'text-white font-medium' : 'text-white/70'}>Livraison</span>
                    </div>
                    <div className="flex items-center gap-2"><Lock className="w-3 h-3 text-emerald-400" /><span className="text-xs text-emerald-400">Paiement par carte</span></div>
                    <span className="text-xs text-white/40">+{formatPrice(DELIVERY_FEE)}</span>
                  </motion.button>
                  
                  <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setOrderType('pickup')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-start gap-2 ${orderType === 'pickup' ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                    <div className="flex items-center gap-2">
                      <Store className={`w-5 h-5 ${orderType === 'pickup' ? 'text-emerald-400' : 'text-white/50'}`} />
                      <span className={orderType === 'pickup' ? 'text-white font-medium' : 'text-white/70'}>Sur place</span>
                    </div>
                    <div className="flex items-center gap-2"><Banknote className="w-3 h-3 text-amber-400" /><span className="text-xs text-amber-400">Paiement au retrait</span></div>
                    <span className="text-xs text-white/40">Pas de frais</span>
                  </motion.button>
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Vos informations</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="text" name="firstName" placeholder="Prénom *" value={formData.firstName} onChange={handleInputChange} required className="input pl-12" /></div>
                  <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="text" name="lastName" placeholder="Nom *" value={formData.lastName} onChange={handleInputChange} required className="input pl-12" /></div>
                  <div className="relative"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="email" name="email" placeholder="Email *" value={formData.email} onChange={handleInputChange} required className="input pl-12" /></div>
                  <div className="relative"><Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="tel" name="phone" placeholder="Téléphone *" value={formData.phone} onChange={handleInputChange} required className="input pl-12" /></div>
                </div>
              </div>
              
              <AnimatePresence>
                {orderType === 'delivery' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                    <h2 className="text-lg font-semibold text-white mb-4">Adresse de livraison</h2>
                    <div className="space-y-4">
                      <div className="relative"><MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" /><input type="text" name="address" placeholder="Adresse *" value={formData.address} onChange={handleInputChange} required={orderType === 'delivery'} className="input pl-12" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <input type="text" name="city" placeholder="Ville *" value={formData.city} onChange={handleInputChange} required={orderType === 'delivery'} className="input" />
                        <input type="text" name="postalCode" placeholder="Code postal *" value={formData.postalCode} onChange={handleInputChange} required={orderType === 'delivery'} className="input" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">Notes (optionnel)</h2>
                <textarea name="notes" placeholder="Instructions spéciales, allergies..." value={formData.notes} onChange={handleInputChange} rows={3} className="input resize-none" />
              </div>
              
              <div className={`rounded-xl p-4 border ${orderType === 'delivery' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <div className="flex items-start gap-3">
                  {orderType === 'delivery' ? (
                    <><CreditCard className="w-5 h-5 text-emerald-400 mt-0.5" /><div><h3 className="font-semibold text-white mb-1">Paiement sécurisé par carte</h3><p className="text-white/60 text-sm">Vous serez redirigé vers Stripe pour finaliser le paiement.</p></div></>
                  ) : (
                    <><Banknote className="w-5 h-5 text-amber-400 mt-0.5" /><div><h3 className="font-semibold text-white mb-1">Paiement sur place</h3><p className="text-white/60 text-sm">Payez en espèces ou par carte au retrait.</p></div></>
                  )}
                </div>
              </div>
              
              <motion.button type="submit" disabled={isSubmitting || !isFormValid} whileHover={{ scale: (isSubmitting || !isFormValid) ? 1 : 1.02 }} whileTap={{ scale: (isSubmitting || !isFormValid) ? 1 : 0.98 }}
                className={`lg:hidden w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${orderType === 'delivery' ? 'bg-gradient-emerald text-white shadow-emerald-500/30' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/30'}`}>
                {isSubmitting ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full" /> : orderType === 'delivery' ? <><Lock className="w-5 h-5" /><span>Payer {formatPrice(finalTotal)}</span></> : <><Store className="w-5 h-5" /><span>Valider • {formatPrice(finalTotal)}</span></>}
              </motion.button>
            </form>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:sticky lg:top-28 lg:self-start">
            <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 lg:p-8">
              <h2 className="text-xl font-bold text-white mb-6">Récapitulatif</h2>
              <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0"><img src={item.productImage} alt={item.productName} className="w-full h-full object-cover" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2"><h3 className="font-medium text-white truncate">{item.productName}</h3><span className="text-white font-semibold whitespace-nowrap">{formatPrice(item.unitPrice * item.quantity)}</span></div>
                      <p className="text-white/40 text-xs mt-1 line-clamp-1">{formatSelectedOptions(item.selectedOptions, item.optionGroups)}</p>
                      <span className="text-white/50 text-sm">Qté: {item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 pt-4 space-y-3">
                <div className="flex items-center justify-between text-sm"><span className="text-white/50">Sous-total</span><span className="text-white">{formatPrice(totalPrice)}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-white/50">Livraison</span><span className={orderType === 'delivery' ? 'text-white' : 'text-emerald-400'}>{orderType === 'delivery' ? formatPrice(DELIVERY_FEE) : 'Gratuit'}</span></div>
                <div className="flex items-center justify-between pt-3 border-t border-white/10"><span className="font-semibold text-white">Total</span><span className="text-2xl font-bold text-emerald-400">{formatPrice(finalTotal)}</span></div>
              </div>
              <motion.button type="submit" form="checkout-form" disabled={isSubmitting || !isFormValid} whileHover={{ scale: (isSubmitting || !isFormValid) ? 1 : 1.02 }} whileTap={{ scale: (isSubmitting || !isFormValid) ? 1 : 0.98 }}
                onClick={orderType === 'delivery' ? handleStripePayment : handlePickupOrder}
                className={`hidden lg:flex w-full mt-6 py-4 rounded-2xl font-bold text-lg items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${orderType === 'delivery' ? 'bg-gradient-emerald text-white shadow-emerald-500/30' : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/30'}`}>
                {isSubmitting ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full" /> : orderType === 'delivery' ? <><Lock className="w-5 h-5" /><span>Payer par carte</span></> : <><Store className="w-5 h-5" /><span>Valider la commande</span></>}
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
