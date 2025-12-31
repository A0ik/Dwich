import { SIZE_TO_MEAT_LIMIT, SIZE_GROUP_TO_MEAT_GROUP } from './constants';

// Restaurant info centralisée
export const RESTAURANT_INFO = {
  name: 'Dwich 62',
  address: '135 Ter Rue Jules Guesde, 62800 Liévin',
  phone: '07 67 46 95 02',
  email: 'dwich62bruay@gmail.com',
  hours: {
    lundi: '11:00-15:00 / 18:00-22:00',
    mardi: '11:00-15:00 / 18:00-22:00',
    mercredi: '11:00-22:00',
    jeudi: '11:00-15:00 / 18:00-22:00',
    vendredi: '11:00-15:00 / 18:00-22:00',
    samedi: '11:00-15:00 / 18:00-22:00',
    dimanche: '11:00-15:00 / 18:00-22:00',
  },
  googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=135+Ter+Rue+Jules+Guesde+62800+Liévin',
};

// --- Boissons ---
// Règle métier:
// - Une boisson ajoutée en option coûte +1,50€
// - Si le produit est pris "en menu" (ou inclut déjà une boisson), la boisson devient gratuite
// Les boissons ne sont pas des produits à part: elles sont gérées comme une option (comme les sauces).

export const isDrinkIncluded = (product, selectedOptions = {}, optionGroups = []) => {
  // Cas "incluse" explicite au niveau du produit (ex: Tacos, Salade menu)
  if (product?.includesDrink) return true;

  // Cas "menu": on détecte via les options "Formule"
  const formule =
    selectedOptions?.['formule-burger'] ||
    selectedOptions?.['formule-sandwich'] ||
    selectedOptions?.['formule'] ||
    null;

  if (!formule) return false;

  const normalized = String(formule).toLowerCase();
  // On considère que le menu inclut boisson si le libellé contient "menu" et "boisson"
  return normalized.includes('menu') && normalized.includes('boisson');
};

export const getEffectivePriceDelta = (product, group, option, selectedOptions = {}) => {
  const baseDelta = option?.priceDelta || 0;
  if (group?.slug !== 'boisson') return baseDelta;
  return isDrinkIncluded(product, selectedOptions, product?.optionGroups) ? 0 : baseDelta;
};

/**
 * Formate un prix en centimes vers un prix en euros
 * @param {number} cents - Prix en centimes
 * @returns {string} Prix formaté en euros (ex: "9,00 €")
 */
export const formatPrice = (cents) => {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
};

/**
 * Calcule le prix total d'un produit avec ses options sélectionnées
 * @param {number} basePrice - Prix de base en centimes
 * @param {Object} selectedOptions - Options sélectionnées par groupe
 * @param {Array} optionGroups - Groupes d'options du produit
 * @returns {number} Prix total en centimes
 */
export const calculateTotalPrice = (basePrice, selectedOptions, optionGroups, product = null) => {
  let total = basePrice;
  
  optionGroups.forEach(group => {
    const selected = selectedOptions[group.slug];
    if (!selected) return;

    // SINGLE
    if (group.type === 'SINGLE') {
      const option = group.options.find(opt => opt.name === selected);
      if (option) {
        total += getEffectivePriceDelta(product, group, option, selectedOptions);
      }
      return;
    }

    // MULTIPLE
    if (group.type === 'MULTIPLE') {
      selected.forEach(optionName => {
        const option = group.options.find(opt => opt.name === optionName);
        if (option) {
          total += getEffectivePriceDelta(product, group, option, selectedOptions);
        }
      });
    }
  });
  
  return total;
};

/**
 * Extrait la limite de viandes depuis la taille sélectionnée
 * @param {string} sizeGroupSlug - Slug du groupe taille (ex: 'taille-assiette')
 * @param {string} selectedSize - Nom de la taille sélectionnée
 * @returns {number|null} Limite de viandes ou null si pas de mapping
 */
export const getMeatLimitFromSize = (sizeGroupSlug, selectedSize) => {
  const sizeMapping = SIZE_TO_MEAT_LIMIT[sizeGroupSlug];
  if (!sizeMapping || !selectedSize) return null;
  return sizeMapping[selectedSize] || null;
};

/**
 * Obtient le slug du groupe viandes associé à un groupe taille
 * @param {string} sizeGroupSlug - Slug du groupe taille
 * @returns {string|null} Slug du groupe viandes ou null
 */
export const getMeatGroupFromSizeGroup = (sizeGroupSlug) => {
  return SIZE_GROUP_TO_MEAT_GROUP[sizeGroupSlug] || null;
};

/**
 * Vérifie si toutes les options requises sont sélectionnées
 * Prend en compte la limite dynamique taille -> viandes
 * @param {Object} selectedOptions - Options sélectionnées
 * @param {Array} optionGroups - Groupes d'options
 * @returns {boolean} True si toutes les options requises sont valides
 */
export const validateRequiredOptions = (selectedOptions, optionGroups) => {
  // Chercher un groupe taille qui impose une limite
  let dynamicLimits = {};
  
  for (const group of optionGroups) {
    if (SIZE_TO_MEAT_LIMIT[group.slug]) {
      const selectedSize = selectedOptions[group.slug];
      const meatGroupSlug = getMeatGroupFromSizeGroup(group.slug);
      const meatLimit = getMeatLimitFromSize(group.slug, selectedSize);
      
      if (meatGroupSlug && meatLimit) {
        dynamicLimits[meatGroupSlug] = meatLimit;
      }
    }
  }
  
  for (const group of optionGroups) {
    const selected = selectedOptions[group.slug];
    
    if (group.required) {
      if (group.type === 'SINGLE') {
        if (!selected) return false;
      } else if (group.type === 'MULTIPLE') {
        if (!selected || selected.length === 0) return false;
        
        // Vérifier la limite dynamique
        const dynamicLimit = dynamicLimits[group.slug];
        if (dynamicLimit && selected.length > dynamicLimit) {
          return false;
        }
      }
    }
    
    // Vérifier maxSelect même si pas required
    if (group.type === 'MULTIPLE' && selected) {
      const dynamicLimit = dynamicLimits[group.slug];
      const effectiveMax = dynamicLimit || group.maxSelect;
      
      if (effectiveMax && selected.length > effectiveMax) {
        return false;
      }
    }
  }
  
  return true;
};

/**
 * Ajuste les sélections de viandes si elles dépassent la nouvelle limite
 * @param {Object} selectedOptions - Options actuellement sélectionnées
 * @param {string} sizeGroupSlug - Slug du groupe taille modifié
 * @param {string} newSize - Nouvelle taille sélectionnée
 * @returns {{ adjustedOptions: Object, wasAdjusted: boolean }}
 */
export const adjustMeatSelectionToSize = (selectedOptions, sizeGroupSlug, newSize) => {
  const meatGroupSlug = getMeatGroupFromSizeGroup(sizeGroupSlug);
  const newLimit = getMeatLimitFromSize(sizeGroupSlug, newSize);
  
  if (!meatGroupSlug || !newLimit) {
    return { adjustedOptions: selectedOptions, wasAdjusted: false };
  }
  
  const currentMeats = selectedOptions[meatGroupSlug] || [];
  
  if (currentMeats.length > newLimit) {
    // Tronquer la sélection (garder les premières)
    return {
      adjustedOptions: {
        ...selectedOptions,
        [meatGroupSlug]: currentMeats.slice(0, newLimit),
      },
      wasAdjusted: true,
    };
  }
  
  return { adjustedOptions: selectedOptions, wasAdjusted: false };
};

/**
 * Génère un ID unique pour les items du panier
 * @returns {string} ID unique
 */
export const generateCartItemId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Génère un ID de commande unique
 * @returns {string} ID de commande
 */
export const generateOrderId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `CMD-${timestamp}${random}`;
};

/**
 * Formate les options sélectionnées en string lisible
 * @param {Object} selectedOptions - Options sélectionnées
 * @param {Array} optionGroups - Groupes d'options
 * @returns {string} Description des options
 */
export const formatSelectedOptions = (selectedOptions, optionGroups) => {
  const parts = [];
  
  optionGroups.forEach(group => {
    const selected = selectedOptions[group.slug];
    if (selected) {
      if (group.type === 'SINGLE') {
        parts.push(selected);
      } else if (group.type === 'MULTIPLE' && selected.length > 0) {
        parts.push(selected.join(', '));
      }
    }
  });
  
  return parts.join(' • ');
};

/**
 * Calcule le prix minimum d'un produit (prix de base + options les moins chères obligatoires)
 * @param {Object} product - Produit
 * @returns {number} Prix minimum en centimes
 */
export const getMinPrice = (product) => {
  let minPrice = product.basePrice;
  
  product.optionGroups.forEach(group => {
    if (group.required && group.options.length > 0) {
      const minDelta = Math.min(...group.options.map(opt => opt.priceDelta));
      minPrice += minDelta;
    }
  });
  
  return minPrice;
};

/**
 * Vérifie si un produit a des options configurables
 * @param {Object} product - Produit
 * @returns {boolean} True si le produit a des options
 */
export const hasOptions = (product) => {
  return product.optionGroups && product.optionGroups.length > 0;
};

/**
 * Formate les détails de commande pour WhatsApp/notification
 * @param {Object} order - Objet commande
 * @returns {string} Message formaté
 */
export const formatOrderForNotification = (order) => {
  const lines = [
    `🆕 NOUVELLE COMMANDE #${order.id}`,
    `📍 Mode: ${order.orderType === 'delivery' ? 'Livraison' : 'Sur place'}`,
    `👤 ${order.customer.firstName} ${order.customer.lastName}`,
    `📞 ${order.customer.phone}`,
    `📧 ${order.customer.email}`,
    '',
    '📝 Articles:',
  ];
  
  order.items.forEach(item => {
    lines.push(`- ${item.quantity}x ${item.productName} (${formatPrice(item.unitPrice * item.quantity)})`);
    const options = formatSelectedOptions(item.selectedOptions, item.optionGroups);
    if (options) {
      lines.push(`  → ${options}`);
    }
  });
  
  lines.push('');
  lines.push(`💰 Sous-total: ${formatPrice(order.subtotal)}`);
  
  if (order.deliveryFee > 0) {
    lines.push(`🚚 Livraison: ${formatPrice(order.deliveryFee)}`);
  }
  
  lines.push(`💳 TOTAL: ${formatPrice(order.total)}`);
  
  if (order.orderType === 'delivery') {
    lines.push('');
    lines.push(`📍 Adresse: ${order.customer.address}, ${order.customer.postalCode} ${order.customer.city}`);
  }
  
  if (order.notes) {
    lines.push('');
    lines.push(`📋 Notes: ${order.notes}`);
  }
  
  return lines.join('\n');
};

// --- Backward compatibility ---
// Some older code may import `validateOrderOptions`.
// Keep it as an alias to avoid breaking builds.
export const validateOrderOptions = validateRequiredOptions;
