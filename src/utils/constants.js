// Configuration du restaurant
export const RESTAURANT_CONFIG = {
  name: 'DWICH62',
  phone: '07 67 46 95 02',
  email: 'dwich62bruay@gmail.com',
  address: '135 Ter Rue Jules Guesde, 62800 Liévin',
};

// Lien Google Maps
export const MAP_LINK = "https://www.google.com/maps/search/?api=1&query=135+Ter+Rue+Jules+Guesde+62800+Liévin";

// URL iframe Google Maps pour la vraie adresse
export const MAP_EMBED_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2534.8!2d2.7789!3d50.4178!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47dd30e5f3c4c9c7%3A0x0!2s135%20Ter%20Rue%20Jules%20Guesde%2C%2062800%20Li%C3%A9vin!5e0!3m2!1sfr!2sfr!4v1704067200000";

// Frais de livraison en centimes (500 = 5€)
export const DELIVERY_FEE = 500;

// Minimum de commande pour la livraison en centimes (1500 = 15€)
export const MINIMUM_DELIVERY_ORDER = 1500;

// Montant minimum pour la livraison gratuite (en centimes, null = jamais gratuit)
export const FREE_DELIVERY_THRESHOLD = null;

// Configuration Stripe (les vraies clés seront dans .env)
export const STRIPE_CONFIG = {
  // URL de retour après paiement réussi
  successUrl: '/checkout/success',
  // URL de retour après annulation
  cancelUrl: '/checkout',
};

// Mapping taille -> nombre de viandes max
// Utilisé pour la validation dynamique Assiettes et Tacos
export const SIZE_TO_MEAT_LIMIT = {
  // Pour les Assiettes
  'taille-assiette': {
    '1 viande': 1,
    '2 viandes': 2,
    '3 viandes': 3,
  },
  // Pour les Tacos
  'taille-tacos': {
    'M (1 viande)': 1,
    'L (2 viandes)': 2,
    'XL (3 viandes)': 3,
  },
};

// Mapping groupe taille -> groupe viandes
export const SIZE_GROUP_TO_MEAT_GROUP = {
  'taille-assiette': 'viandes-assiette',
  'taille-tacos': 'viandes-tacos',
};
