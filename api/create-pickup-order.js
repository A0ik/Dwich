/**
 * API Route: POST /api/create-pickup-order
 * Commande sur place - Email + WhatsApp via Brevo
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, customerInfo, orderType, totalAmount } = req.body;
    const orderId = generateOrderId();
    
    const orderData = { orderId, items, customerInfo, orderType, totalAmount, createdAt: new Date().toISOString() };

    console.log('📝 New pickup order:', orderId);

    // WhatsApp
    try { await sendWhatsAppNotification(orderData); console.log('✅ WhatsApp sent'); } 
    catch (e) { console.error('❌ WhatsApp:', e.message); }

    // Email client
    try { await sendEmailToCustomer(orderData); console.log('✅ Customer email sent'); } 
    catch (e) { console.error('❌ Customer email:', e.message); }

    // Email restaurant
    try { await sendEmailToRestaurant(orderData); console.log('✅ Restaurant email sent'); } 
    catch (e) { console.error('❌ Restaurant email:', e.message); }

    res.status(200).json({ success: true, orderId });
  } catch (error) {
    console.error('Order error:', error);
    res.status(500).json({ error: error.message });
  }
}

function generateOrderId() {
  return (Date.now().toString(36) + Math.random().toString(36).substr(2, 4)).toUpperCase().slice(-8);
}

// ============ BREVO EMAIL ============
async function sendEmailViaBREVO(to, subject, htmlContent, toName = '') {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) { console.log('❌ BREVO_API_KEY not configured'); return null; }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'DWICH62', email: process.env.BREVO_SENDER_EMAIL || 'dwich62bruay@gmail.com' },
      to: [{ email: to, name: toName }],
      subject, htmlContent,
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(`Brevo: ${JSON.stringify(result)}`);
  return result;
}

// ============ WHATSAPP ============
async function sendWhatsAppNotification(order) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_WHATSAPP_FROM: from, RESTAURANT_WHATSAPP_NUMBER: to } = process.env;
  if (!sid || !token || !from || !to) return;

  const total = (order.totalAmount / 100).toFixed(2);
  const products = order.items.map(i => `• ${i.quantity}x ${i.name}${i.description ? `\n   → ${i.description}` : ''}`).join('\n');

  const message = `🏪 *COMMANDE SUR PLACE*

━━━━━━━━━━━━━━━━━━━
📋 *#${order.orderId}*
💰 *${total}€*
💵 *PAIEMENT AU RETRAIT*
━━━━━━━━━━━━━━━━━━━

👤 ${order.customerInfo.firstName} ${order.customerInfo.lastName}
📞 ${order.customerInfo.phone}
📧 ${order.customerInfo.email}

━━━━━━━━━━━━━━━━━━━
${products}
━━━━━━━━━━━━━━━━━━━
${order.customerInfo.notes ? `📝 ${order.customerInfo.notes}\n` : ''}
⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`;

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: message }),
  });

  const result = await response.json();
  if (!response.ok && result.code !== 63016) throw new Error(JSON.stringify(result));
}

// ============ EMAIL CLIENT ============
async function sendEmailToCustomer(order) {
  const email = order.customerInfo.email;
  if (!email) return;

  const total = (order.totalAmount / 100).toFixed(2);
  const products = order.items.map(i => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;"><strong>${i.name}</strong>${i.description ? `<br><span style="color: #6b7280; font-size: 13px;">→ ${i.description}</span>` : ''}</td>
      <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: center;">${i.quantity}</td>
      <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right;">${(i.unitPrice * i.quantity / 100).toFixed(2)}€</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background: #f3f4f6; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 16px 16px 0 0; padding: 40px; text-align: center;">
      <div style="font-size: 48px;">🍔</div>
      <h1 style="color: white; margin: 10px 0 0 0;">DWICH62</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Commande confirmée !</p>
    </div>
    <div style="background: white; padding: 40px; border-radius: 0 0 16px 16px;">
      <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 16px; padding: 25px; text-align: center; margin-bottom: 30px;">
        <p style="margin: 0; color: #92400e;">Numéro de commande</p>
        <p style="margin: 8px 0 0 0; color: #d97706; font-size: 42px; font-weight: bold;">#${order.orderId}</p>
      </div>
      <div style="background: #dbeafe; border-radius: 12px; padding: 15px; text-align: center; margin-bottom: 25px;">
        <p style="margin: 0; color: #1e40af; font-weight: bold;">🏪 RETRAIT SUR PLACE</p>
        <p style="margin: 5px 0 0 0; color: #1e3a8a;">Paiement au retrait • Prêt dans 15-20 min</p>
      </div>
      <p style="color: #374151;">Bonjour <strong>${order.customerInfo.firstName}</strong>, merci pour votre commande !</p>
      <h2 style="border-bottom: 3px solid #f59e0b; padding-bottom: 10px;">📋 Votre commande</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="background: #f9fafb;"><th style="padding: 12px; text-align: left;">Produit</th><th style="padding: 12px; text-align: center;">Qté</th><th style="padding: 12px; text-align: right;">Prix</th></tr></thead>
        <tbody>${products}</tbody>
      </table>
      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
        <p style="margin: 0; font-size: 20px; font-weight: bold;">Total à payer: <span style="float: right; color: #f59e0b;">${total}€</span></p>
      </div>
      <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center;">
        <h3 style="margin: 0 0 10px 0; color: #166534;">📍 Adresse</h3>
        <p style="margin: 0; color: #15803d;"><strong>135 Ter Rue Jules Guesde, 62800 Liévin</strong></p>
        <p style="margin: 10px 0 0 0; color: #166534;">📞 07 67 46 95 02</p>
      </div>
      ${order.customerInfo.notes ? `<div style="background: #f3f4f6; border-radius: 12px; padding: 15px; margin-top: 20px;"><p style="margin: 0;">📝 <strong>Vos notes:</strong> ${order.customerInfo.notes}</p></div>` : ''}
    </div>
    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;"><p style="margin: 0;">© ${new Date().getFullYear()} DWICH62</p></div>
  </div>
</body>
</html>`;

  return sendEmailViaBREVO(email, `✅ Commande #${order.orderId} - Retrait sur place - DWICH62`, html, `${order.customerInfo.firstName} ${order.customerInfo.lastName}`);
}

// ============ EMAIL RESTAURANT ============
async function sendEmailToRestaurant(order) {
  const restaurantEmail = process.env.RESTAURANT_EMAIL || 'dwich62bruay@gmail.com';
  const total = (order.totalAmount / 100).toFixed(2);
  const products = order.items.map(i => `<tr><td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>${i.quantity}x ${i.name}</strong></td><td style="padding: 12px; border-bottom: 1px solid #ddd;">${i.description || '-'}</td><td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">${(i.unitPrice * i.quantity / 100).toFixed(2)}€</td></tr>`).join('');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background: #f5f5f5; font-family: Arial;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="background: #f59e0b; padding: 20px; text-align: center;"><h1 style="color: white; margin: 0;">🏪 COMMANDE SUR PLACE</h1></div>
    <div style="background: #fef3c7; padding: 20px; text-align: center; border-bottom: 3px solid #f59e0b;">
      <p style="margin: 0; color: #666;">Commande</p>
      <p style="margin: 5px 0; color: #d97706; font-size: 36px; font-weight: bold;">#${order.orderId}</p>
      <p style="margin: 10px 0; font-size: 24px; font-weight: bold; color: #16a34a;">${total}€</p>
      <p style="margin: 0; background: #dc2626; color: white; display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold;">💵 À ENCAISSER</p>
    </div>
    <div style="padding: 20px; background: #f9f9f9;">
      <h2 style="margin: 0 0 15px 0;">👤 CLIENT</h2>
      <p style="margin: 5px 0;"><strong>Nom:</strong> ${order.customerInfo.firstName} ${order.customerInfo.lastName}</p>
      <p style="margin: 5px 0;"><strong>Tél:</strong> <a href="tel:${order.customerInfo.phone}" style="color: #dc2626;">${order.customerInfo.phone}</a></p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${order.customerInfo.email}</p>
    </div>
    <div style="padding: 20px;">
      <h2 style="margin: 0 0 15px 0;">🍔 COMMANDE</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="background: #f3f4f6;"><th style="padding: 12px; text-align: left;">Produit</th><th style="padding: 12px; text-align: left;">Options</th><th style="padding: 12px; text-align: right;">Prix</th></tr></thead>
        <tbody>${products}</tbody>
        <tfoot><tr style="background: #f59e0b; color: white;"><td colspan="2" style="padding: 15px; font-size: 18px; font-weight: bold;">TOTAL À ENCAISSER</td><td style="padding: 15px; text-align: right; font-size: 24px; font-weight: bold;">${total}€</td></tr></tfoot>
      </table>
    </div>
    ${order.customerInfo.notes ? `<div style="padding: 20px; background: #fef3c7;"><h3 style="margin: 0 0 10px 0;">📝 NOTES</h3><p style="margin: 0; font-weight: bold;">${order.customerInfo.notes}</p></div>` : ''}
    <div style="padding: 15px; background: #333; text-align: center;"><p style="margin: 0; color: #999; font-size: 12px;">${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p></div>
  </div>
</body>
</html>`;

  return sendEmailViaBREVO(restaurantEmail, `🏪 SUR PLACE #${order.orderId} - ${total}€ - À ENCAISSER`, html, 'DWICH62');
}
