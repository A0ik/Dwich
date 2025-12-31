/**
 * API Route: POST /api/webhook-stripe
 * Webhook Stripe - Envoie WhatsApp + Email restaurant + Email client
 * Utilise Brevo (ex-Sendinblue) pour les emails - 300/jour gratuit
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const sessionFromEvent = event.data.object;
    console.log('✅ Payment received:', sessionFromEvent.id);
    
    // Récupérer la session complète avec customer_details
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionFromEvent.id, {
        expand: ['customer_details', 'line_items']
      });
    } catch (e) {
      console.error('Error retrieving session:', e);
      session = sessionFromEvent;
    }

    // Récupérer les line_items
    let lineItems = [];
    try {
      if (session.line_items?.data) {
        lineItems = session.line_items.data;
      } else {
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
        lineItems = items.data;
      }
    } catch (e) {
      console.error('Error fetching line items:', e);
    }

    // 1. WhatsApp au restaurant
    try {
      await sendWhatsAppNotification(session, lineItems);
      console.log('✅ WhatsApp sent');
    } catch (error) {
      console.error('❌ WhatsApp error:', error.message);
    }

    // 2. Email au client (Brevo)
    try {
      await sendEmailToCustomer(session, lineItems);
      console.log('✅ Customer email sent');
    } catch (error) {
      console.error('❌ Customer email error:', error.message);
    }

    // 3. Email au restaurant (Brevo)
    try {
      await sendEmailToRestaurant(session, lineItems);
      console.log('✅ Restaurant email sent');
    } catch (error) {
      console.error('❌ Restaurant email error:', error.message);
    }
  }

  res.status(200).json({ received: true });
}

// ============ WHATSAPP ============
async function sendWhatsAppNotification(session, lineItems) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.RESTAURANT_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !from || !to) return;

  const meta = session.metadata || {};
  const orderId = session.id.slice(-8).toUpperCase();
  const total = (session.amount_total / 100).toFixed(2);
  
  let itemsDetails = [];
  try { if (meta.itemsJson) itemsDetails = JSON.parse(meta.itemsJson); } catch (e) {}

  let productsText = itemsDetails.length > 0
    ? itemsDetails.map(item => {
        let line = `• ${item.qty}x ${item.name} (${(item.price / 100).toFixed(2)}€)`;
        if (item.options) line += `\n   → ${item.options}`;
        return line;
      }).join('\n')
    : lineItems.filter(i => i.description !== 'Livraison à domicile').map(i => `• ${i.quantity}x ${i.description}`).join('\n');

  const message = `🍔 *NOUVELLE COMMANDE DWICH62*

━━━━━━━━━━━━━━━━━━━
📋 *Commande #${orderId}*
💰 *Total: ${total}€*
💳 *PAYÉ PAR CARTE*
━━━━━━━━━━━━━━━━━━━

👤 *Client:* ${meta.customerName || 'N/A'}
📞 *Tél:* ${meta.customerPhone || 'N/A'}
📧 *Email:* ${meta.customerEmail || session.customer_email || 'N/A'}

📍 *Mode:* ${meta.orderType === 'delivery' ? '🚚 LIVRAISON' : '🏪 SUR PLACE'}
${meta.orderType === 'delivery' ? `🏠 *Adresse:* ${meta.customerAddress}` : ''}

━━━━━━━━━━━━━━━━━━━
🍽️ *DÉTAILS:*
━━━━━━━━━━━━━━━━━━━
${productsText}
━━━━━━━━━━━━━━━━━━━
${meta.notes ? `📝 *Notes:* ${meta.notes}\n` : ''}
⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`;

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: message }),
  });

  const result = await response.json();
  if (!response.ok && result.code !== 63016) throw new Error(JSON.stringify(result));
}

// ============ ENVOYER EMAIL VIA BREVO ============
async function sendEmailViaBREVO(to, subject, htmlContent, toName = '') {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log('❌ BREVO_API_KEY not configured');
    return null;
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { 
        name: 'DWICH62', 
        email: process.env.BREVO_SENDER_EMAIL || 'dwich62bruay@gmail.com' 
      },
      to: [{ email: to, name: toName }],
      subject: subject,
      htmlContent: htmlContent,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Brevo: ${JSON.stringify(result)}`);
  }
  return result;
}

// ============ EMAIL CLIENT ============
async function sendEmailToCustomer(session, lineItems) {
  const meta = session.metadata || {};
  const orderId = session.id.slice(-8).toUpperCase();
  const total = (session.amount_total / 100).toFixed(2);
  const customerEmail = session.customer_email || session.customer_details?.email || meta.customerEmail;
  
  if (!customerEmail) {
    console.log('❌ No customer email found');
    return null;
  }

  console.log('📧 Sending to customer:', customerEmail);

  let itemsDetails = [];
  try { if (meta.itemsJson) itemsDetails = JSON.parse(meta.itemsJson); } catch (e) {}

  let productsHtml = itemsDetails.length > 0
    ? itemsDetails.map(item => `
        <tr>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 600; color: #111827;">${item.name}</div>
            ${item.options ? `<div style="color: #6b7280; font-size: 13px; margin-top: 4px;">→ ${item.options}</div>` : ''}
          </td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.qty}</td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${(item.price * item.qty / 100).toFixed(2)}€</td>
        </tr>
      `).join('')
    : lineItems.filter(i => i.description !== 'Livraison à domicile').map(i => `
        <tr>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${i.description}</td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: center;">${i.quantity}</td>
          <td style="padding: 15px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${(i.amount_total / 100).toFixed(2)}€</td>
        </tr>
      `).join('');

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
      <div style="font-size: 48px;">🍔</div>
      <h1 style="color: white; margin: 10px 0 0 0; font-size: 32px;">DWICH62</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Merci pour votre commande !</p>
    </div>
    
    <div style="background: white; padding: 40px 30px; border-radius: 0 0 16px 16px;">
      
      <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 16px; padding: 25px; text-align: center; margin-bottom: 30px;">
        <p style="margin: 0; color: #166534; font-size: 14px;">Numéro de commande</p>
        <p style="margin: 8px 0 0 0; color: #059669; font-size: 42px; font-weight: bold;">#${orderId}</p>
      </div>
      
      <p style="color: #374151; font-size: 16px; line-height: 1.7;">
        Bonjour <strong>${meta.customerName || 'cher client'}</strong>,<br><br>
        Votre paiement a bien été reçu ! 
        ${meta.orderType === 'delivery' 
          ? '🚚 <strong>Livraison estimée : 30-45 minutes</strong>' 
          : '🏪 <strong>Votre commande sera prête dans 15-20 minutes</strong>'}
      </p>
      
      <h2 style="color: #111827; font-size: 18px; border-bottom: 3px solid #10b981; padding-bottom: 10px;">📋 Votre commande</h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 12px; text-align: left; color: #6b7280; font-size: 12px;">PRODUIT</th>
            <th style="padding: 12px; text-align: center; color: #6b7280; font-size: 12px;">QTÉ</th>
            <th style="padding: 12px; text-align: right; color: #6b7280; font-size: 12px;">PRIX</th>
          </tr>
        </thead>
        <tbody>${productsHtml}</tbody>
      </table>
      
      <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 20px 0;">
        ${meta.orderType === 'delivery' ? '<p style="margin: 0 0 10px 0; color: #6b7280;">Livraison: <span style="float: right;">5,00€</span></p>' : ''}
        <p style="margin: 0; font-size: 20px; font-weight: bold; color: #111827;">Total payé: <span style="float: right; color: #10b981;">${total}€</span></p>
      </div>
      
      ${meta.orderType === 'delivery' ? `
      <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #92400e;">🚚 Adresse de livraison</h3>
        <p style="margin: 0; color: #78350f;">${meta.customerAddress}</p>
      </div>
      ` : `
      <div style="background: #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #1e40af;">🏪 Retrait sur place</h3>
        <p style="margin: 0; color: #1e3a8a;">135 Ter Rue Jules Guesde, 62800 Liévin</p>
      </div>
      `}
      
      ${meta.notes ? `<div style="background: #f3f4f6; border-radius: 12px; padding: 15px; margin-bottom: 20px;"><p style="margin: 0; color: #6b7280;">📝 <strong>Vos notes:</strong> ${meta.notes}</p></div>` : ''}
      
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <p style="color: #6b7280; margin: 0 0 15px 0;">Une question ?</p>
        <a href="tel:0767469502" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">📞 07 67 46 95 02</a>
      </div>
    </div>
    
    <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
      <p style="margin: 0;">DWICH62 - 135 Ter Rue Jules Guesde, 62800 Liévin</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmailViaBREVO(customerEmail, `✅ Commande #${orderId} confirmée - DWICH62`, emailHtml, meta.customerName);
}

// ============ EMAIL RESTAURANT ============
async function sendEmailToRestaurant(session, lineItems) {
  const restaurantEmail = process.env.RESTAURANT_EMAIL || 'dwich62bruay@gmail.com';
  const meta = session.metadata || {};
  const orderId = session.id.slice(-8).toUpperCase();
  const total = (session.amount_total / 100).toFixed(2);

  let itemsDetails = [];
  try { if (meta.itemsJson) itemsDetails = JSON.parse(meta.itemsJson); } catch (e) {}

  let productsHtml = itemsDetails.length > 0
    ? itemsDetails.map(item => `<tr><td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">${item.qty}x ${item.name}</td><td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.options || '-'}</td><td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">${(item.price * item.qty / 100).toFixed(2)}€</td></tr>`).join('')
    : lineItems.filter(i => i.description !== 'Livraison à domicile').map(i => `<tr><td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">${i.quantity}x ${i.description}</td><td style="padding: 12px; border-bottom: 1px solid #ddd;">-</td><td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">${(i.amount_total / 100).toFixed(2)}€</td></tr>`).join('');

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="background: #dc2626; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0;">🚨 NOUVELLE COMMANDE</h1>
    </div>
    <div style="background: #fef2f2; padding: 20px; text-align: center; border-bottom: 3px solid #dc2626;">
      <p style="margin: 0; color: #666;">Commande</p>
      <p style="margin: 5px 0; color: #dc2626; font-size: 36px; font-weight: bold;">#${orderId}</p>
      <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #16a34a;">${total}€</p>
      <p style="margin: 10px 0 0 0; background: #10b981; color: white; display: inline-block; padding: 5px 15px; border-radius: 20px;">💳 PAYÉ</p>
    </div>
    <div style="padding: 20px; background: #f9f9f9;">
      <h2 style="margin: 0 0 15px 0;">👤 CLIENT</h2>
      <p style="margin: 5px 0;"><strong>Nom:</strong> ${meta.customerName || 'N/A'}</p>
      <p style="margin: 5px 0;"><strong>Tél:</strong> <a href="tel:${meta.customerPhone}" style="color: #dc2626;">${meta.customerPhone || 'N/A'}</a></p>
      <p style="margin: 5px 0;"><strong>Email:</strong> ${meta.customerEmail || session.customer_email || 'N/A'}</p>
    </div>
    <div style="padding: 20px; ${meta.orderType === 'delivery' ? 'background: #fef3c7;' : 'background: #dbeafe;'}">
      <h2 style="margin: 0 0 10px 0;">${meta.orderType === 'delivery' ? '🚚 LIVRAISON' : '🏪 SUR PLACE'}</h2>
      ${meta.orderType === 'delivery' ? `<p style="margin: 0; font-weight: bold;">${meta.customerAddress}</p>` : '<p style="margin: 0;">Retrait sur place</p>'}
    </div>
    <div style="padding: 20px;">
      <h2 style="margin: 0 0 15px 0;">🍔 COMMANDE</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="background: #f3f4f6;"><th style="padding: 12px; text-align: left;">Produit</th><th style="padding: 12px; text-align: left;">Options</th><th style="padding: 12px; text-align: right;">Prix</th></tr></thead>
        <tbody>${productsHtml}</tbody>
        <tfoot>
          ${meta.orderType === 'delivery' ? '<tr><td colspan="2" style="padding: 12px; text-align: right;">Livraison:</td><td style="padding: 12px; text-align: right;">5,00€</td></tr>' : ''}
          <tr style="background: #10b981; color: white;"><td colspan="2" style="padding: 15px; font-size: 18px; font-weight: bold;">TOTAL</td><td style="padding: 15px; text-align: right; font-size: 24px; font-weight: bold;">${total}€</td></tr>
        </tfoot>
      </table>
    </div>
    ${meta.notes ? `<div style="padding: 20px; background: #fef3c7;"><h3 style="margin: 0 0 10px 0;">📝 NOTES</h3><p style="margin: 0; font-weight: bold;">${meta.notes}</p></div>` : ''}
    <div style="padding: 15px; background: #333; text-align: center;"><p style="margin: 0; color: #999; font-size: 12px;">${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p></div>
  </div>
</body>
</html>`;

  return sendEmailViaBREVO(restaurantEmail, `🚨 COMMANDE #${orderId} - ${total}€ - ${meta.orderType === 'delivery' ? 'LIVRAISON' : 'SUR PLACE'}`, emailHtml, 'DWICH62');
}
