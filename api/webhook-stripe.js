/**
 * API Route: POST /api/webhook-stripe
 * Webhook Stripe - Envoie WhatsApp au restaurant + Email au client
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
    const session = event.data.object;
    console.log('✅ Payment received:', session.id);

    // Récupérer les line_items
    let lineItems = [];
    try {
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
      lineItems = items.data;
    } catch (e) {
      console.error('Error fetching line items:', e);
    }

    // Envoyer WhatsApp au restaurant
    try {
      await sendWhatsAppNotification(session, lineItems);
      console.log('✅ WhatsApp sent to restaurant');
    } catch (error) {
      console.error('❌ WhatsApp error:', error);
    }

    // Envoyer Email au client
    try {
      await sendEmailConfirmation(session, lineItems);
      console.log('✅ Email sent to customer');
    } catch (error) {
      console.error('❌ Email error:', error);
    }

    // Envoyer Email au restaurant
    try {
      await sendEmailToRestaurant(session, lineItems);
      console.log('✅ Email sent to restaurant');
    } catch (error) {
      console.error('❌ Restaurant email error:', error);
    }
  }

  res.status(200).json({ received: true });
}

// ============ WHATSAPP ============
async function sendWhatsAppNotification(session, lineItems) {
  const message = formatOrderMessage(session, lineItems);
  await sendViaTwilio(message);
}

function formatOrderMessage(session, lineItems) {
  const meta = session.metadata || {};
  const orderId = session.id.slice(-8).toUpperCase();
  const total = (session.amount_total / 100).toFixed(2);
  
  let itemsDetails = [];
  try {
    if (meta.itemsJson) itemsDetails = JSON.parse(meta.itemsJson);
  } catch (e) {}

  let productsText = '';
  if (itemsDetails.length > 0) {
    productsText = itemsDetails.map(item => {
      let line = `• ${item.qty}x ${item.name} (${(item.price / 100).toFixed(2)}€)`;
      if (item.options) line += `\n   → ${item.options}`;
      return line;
    }).join('\n');
  } else {
    productsText = lineItems
      .filter(item => item.description !== 'Livraison à domicile')
      .map(item => `• ${item.quantity}x ${item.description || 'Produit'}`).join('\n');
  }

  return `🍔 *NOUVELLE COMMANDE DWICH62*

━━━━━━━━━━━━━━━━━━━
📋 *Commande #${orderId}*
💰 *Total: ${total}€*
━━━━━━━━━━━━━━━━━━━

👤 *Client:* ${meta.customerName || 'N/A'}
📞 *Tél:* ${meta.customerPhone || 'N/A'}
📧 *Email:* ${session.customer_email || 'N/A'}

📍 *Mode:* ${meta.orderType === 'delivery' ? '🚚 LIVRAISON' : '🏪 SUR PLACE'}
${meta.orderType === 'delivery' ? `🏠 *Adresse:* ${meta.customerAddress}` : ''}

━━━━━━━━━━━━━━━━━━━
🍽️ *DÉTAILS COMMANDE:*
━━━━━━━━━━━━━━━━━━━
${productsText}
━━━━━━━━━━━━━━━━━━━

${meta.notes ? `📝 *Notes:* ${meta.notes}\n` : ''}
⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`;
}

async function sendViaTwilio(message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.RESTAURANT_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !from || !to) {
    throw new Error('Missing Twilio configuration');
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: message }),
    }
  );

  const result = await response.json();
  if (!response.ok && result.code !== 63016) {
    throw new Error(`Twilio error: ${JSON.stringify(result)}`);
  }
  return result;
}

// ============ EMAIL avec RESEND ============
async function sendEmailConfirmation(session, lineItems) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not configured, skipping email');
    return;
  }

  const meta = session.metadata || {};
  const orderId = session.id.slice(-8).toUpperCase();
  const total = (session.amount_total / 100).toFixed(2);
  const customerEmail = session.customer_email;
  
  if (!customerEmail) {
    console.log('No customer email, skipping');
    return;
  }

  let itemsDetails = [];
  try {
    if (meta.itemsJson) itemsDetails = JSON.parse(meta.itemsJson);
  } catch (e) {}

  // Générer le HTML des produits
  let productsHtml = '';
  if (itemsDetails.length > 0) {
    productsHtml = itemsDetails.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <strong>${item.name}</strong>
          ${item.options ? `<br><span style="color: #666; font-size: 13px;">${item.options}</span>` : ''}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${(item.price / 100).toFixed(2)}€</td>
      </tr>
    `).join('');
  } else {
    productsHtml = lineItems
      .filter(item => item.description !== 'Livraison à domicile')
      .map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.description || 'Produit'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${item.amount_total ? (item.amount_total / 100).toFixed(2) : '-'}€</td>
        </tr>
      `).join('');
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🍔 DWICH62</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Confirmation de commande</p>
    </div>
    
    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      
      <!-- Order ID -->
      <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 25px;">
        <p style="margin: 0; color: #666; font-size: 14px;">Numéro de commande</p>
        <p style="margin: 5px 0 0 0; color: #10b981; font-size: 32px; font-weight: bold; letter-spacing: 2px;">#${orderId}</p>
      </div>
      
      <!-- Thank you message -->
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Bonjour <strong>${meta.customerName || 'cher client'}</strong>,<br><br>
        Merci pour votre commande ! Nous la préparons avec soin. 
        ${meta.orderType === 'delivery' 
          ? 'Vous serez livré dans <strong>30-45 minutes</strong>.' 
          : 'Votre commande sera prête dans <strong>15-20 minutes</strong>.'}
      </p>
      
      <!-- Order details -->
      <h2 style="color: #333; font-size: 18px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #10b981;">
        📋 Détails de la commande
      </h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9f9f9;">
            <th style="padding: 12px; text-align: left; font-weight: 600;">Produit</th>
            <th style="padding: 12px; text-align: center; font-weight: 600;">Qté</th>
            <th style="padding: 12px; text-align: right; font-weight: 600;">Prix</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml}
        </tbody>
      </table>
      
      <!-- Total -->
      <div style="background: #f9f9f9; border-radius: 8px; padding: 15px; margin-top: 20px;">
        <table style="width: 100%;">
          ${meta.orderType === 'delivery' ? `
          <tr>
            <td style="padding: 5px 0; color: #666;">Livraison</td>
            <td style="padding: 5px 0; text-align: right; color: #666;">5,00€</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px 0; font-size: 20px; font-weight: bold; color: #333;">Total</td>
            <td style="padding: 10px 0; text-align: right; font-size: 24px; font-weight: bold; color: #10b981;">${total}€</td>
          </tr>
        </table>
      </div>
      
      <!-- Delivery info -->
      ${meta.orderType === 'delivery' ? `
      <div style="margin-top: 25px; padding: 20px; background: #fef3c7; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">🚚 Adresse de livraison</h3>
        <p style="margin: 0; color: #78350f;">${meta.customerAddress}</p>
      </div>
      ` : `
      <div style="margin-top: 25px; padding: 20px; background: #dbeafe; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">🏪 Retrait sur place</h3>
        <p style="margin: 0; color: #1e3a8a;">135 Ter Rue Jules Guesde, 62800 Liévin</p>
      </div>
      `}
      
      ${meta.notes ? `
      <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
        <p style="margin: 0; color: #666;"><strong>📝 Notes:</strong> ${meta.notes}</p>
      </div>
      ` : ''}
      
      <!-- Contact -->
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #666; font-size: 14px; margin: 0;">
          Une question ? Contactez-nous<br>
          <a href="tel:0767469502" style="color: #10b981; text-decoration: none;">📞 07 67 46 95 02</a>
        </p>
      </div>
      
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p style="margin: 0;">DWICH62 - 135 Ter Rue Jules Guesde, 62800 Liévin</p>
      <p style="margin: 5px 0 0 0;">© ${new Date().getFullYear()} Tous droits réservés</p>
    </div>
    
  </div>
</body>
</html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'DWICH62 <onboarding@resend.dev>',
      to: [customerEmail],
      subject: `✅ Commande #${orderId} confirmée - DWICH62`,
      html: emailHtml,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Resend error: ${JSON.stringify(result)}`);
  }
  
  console.log('Email sent:', result);
  return result;
}

// ============ EMAIL AU RESTAURANT ============
async function sendEmailToRestaurant(session, lineItems) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.log('RESEND_API_KEY not configured, skipping restaurant email');
    return;
  }

  const restaurantEmail = process.env.RESTAURANT_EMAIL || 'dwich62bruay@gmail.com';
  const meta = session.metadata || {};
  const orderId = session.id.slice(-8).toUpperCase();
  const total = (session.amount_total / 100).toFixed(2);

  let itemsDetails = [];
  try {
    if (meta.itemsJson) itemsDetails = JSON.parse(meta.itemsJson);
  } catch (e) {}

  // Générer le HTML des produits
  let productsHtml = '';
  if (itemsDetails.length > 0) {
    productsHtml = itemsDetails.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">${item.qty}x ${item.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.options || '-'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">${(item.price * item.qty / 100).toFixed(2)}€</td>
      </tr>
    `).join('');
  } else {
    productsHtml = lineItems
      .filter(item => item.description !== 'Livraison à domicile')
      .map(item => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">${item.quantity}x ${item.description || 'Produit'}</td>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;">-</td>
          <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">${item.amount_total ? (item.amount_total / 100).toFixed(2) : '-'}€</td>
        </tr>
      `).join('');
  }

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    
    <!-- Header rouge pour urgence -->
    <div style="background: #dc2626; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🚨 NOUVELLE COMMANDE</h1>
    </div>
    
    <!-- Order ID -->
    <div style="background: #fef2f2; padding: 20px; text-align: center; border-bottom: 3px solid #dc2626;">
      <p style="margin: 0; color: #666;">Commande</p>
      <p style="margin: 5px 0; color: #dc2626; font-size: 36px; font-weight: bold;">#${orderId}</p>
      <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #16a34a;">${total}€</p>
    </div>
    
    <!-- Client info -->
    <div style="padding: 20px; background: #f9f9f9;">
      <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">👤 CLIENT</h2>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Nom:</td>
          <td style="padding: 5px 0; font-weight: bold;">${meta.customerName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Téléphone:</td>
          <td style="padding: 5px 0; font-weight: bold;"><a href="tel:${meta.customerPhone}" style="color: #dc2626;">${meta.customerPhone || 'N/A'}</a></td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Email:</td>
          <td style="padding: 5px 0;">${session.customer_email || 'N/A'}</td>
        </tr>
      </table>
    </div>
    
    <!-- Mode de livraison -->
    <div style="padding: 20px; ${meta.orderType === 'delivery' ? 'background: #fef3c7; border-left: 4px solid #f59e0b;' : 'background: #dbeafe; border-left: 4px solid #3b82f6;'}">
      <h2 style="margin: 0 0 10px 0; color: #333; font-size: 18px;">
        ${meta.orderType === 'delivery' ? '🚚 LIVRAISON' : '🏪 SUR PLACE'}
      </h2>
      ${meta.orderType === 'delivery' ? `<p style="margin: 0; font-size: 16px; font-weight: bold;">${meta.customerAddress}</p>` : '<p style="margin: 0;">Le client viendra chercher sa commande</p>'}
    </div>
    
    <!-- Produits -->
    <div style="padding: 20px;">
      <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">🍔 COMMANDE</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 12px; text-align: left;">Produit</th>
            <th style="padding: 12px; text-align: left;">Options/Sauces</th>
            <th style="padding: 12px; text-align: right;">Prix</th>
          </tr>
        </thead>
        <tbody>
          ${productsHtml}
        </tbody>
        <tfoot>
          ${meta.orderType === 'delivery' ? `
          <tr>
            <td colspan="2" style="padding: 12px; text-align: right;">Livraison:</td>
            <td style="padding: 12px; text-align: right;">5,00€</td>
          </tr>
          ` : ''}
          <tr style="background: #10b981; color: white;">
            <td colspan="2" style="padding: 15px; font-size: 18px; font-weight: bold;">TOTAL</td>
            <td style="padding: 15px; text-align: right; font-size: 24px; font-weight: bold;">${total}€</td>
          </tr>
        </tfoot>
      </table>
    </div>
    
    ${meta.notes ? `
    <div style="padding: 20px; background: #fef3c7; border-top: 1px solid #f59e0b;">
      <h2 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">📝 NOTES DU CLIENT</h2>
      <p style="margin: 0; color: #78350f; font-weight: bold;">${meta.notes}</p>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div style="padding: 15px; background: #333; text-align: center;">
      <p style="margin: 0; color: #999; font-size: 12px;">
        Commande reçue le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
      </p>
    </div>
    
  </div>
</body>
</html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'DWICH62 <onboarding@resend.dev>',
      to: [restaurantEmail],
      subject: `🚨 COMMANDE #${orderId} - ${total}€ - ${meta.orderType === 'delivery' ? 'LIVRAISON' : 'SUR PLACE'}`,
      html: emailHtml,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Resend error (restaurant): ${JSON.stringify(result)}`);
  }
  
  console.log('Restaurant email sent:', result);
  return result;
}
