/**
 * API Route: POST /api/create-pickup-order
 * Crée une commande sur place et envoie les notifications (Email + WhatsApp)
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, customerInfo, orderType, totalAmount } = req.body;

    // Générer un ID de commande unique
    const orderId = generateOrderId();
    
    // Préparer les données de la commande
    const orderData = {
      orderId,
      items,
      customerInfo,
      orderType,
      totalAmount,
      paymentMethod: 'on_site',
      createdAt: new Date().toISOString(),
    };

    console.log('📝 New pickup order:', orderId);

    // Envoyer WhatsApp au restaurant
    try {
      await sendWhatsAppNotification(orderData);
      console.log('✅ WhatsApp sent');
    } catch (error) {
      console.error('❌ WhatsApp error:', error.message);
    }

    // Envoyer Email au client
    try {
      await sendEmailToCustomer(orderData);
      console.log('✅ Customer email sent');
    } catch (error) {
      console.error('❌ Customer email error:', error.message);
    }

    // Envoyer Email au restaurant
    try {
      await sendEmailToRestaurant(orderData);
      console.log('✅ Restaurant email sent');
    } catch (error) {
      console.error('❌ Restaurant email error:', error.message);
    }

    res.status(200).json({ 
      success: true, 
      orderId,
      message: 'Commande créée avec succès'
    });

  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message });
  }
}

function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${timestamp}${random}`.slice(-8);
}

// ============ WHATSAPP ============
async function sendWhatsAppNotification(order) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const to = process.env.RESTAURANT_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !from || !to) {
    console.log('Twilio not configured, skipping WhatsApp');
    return;
  }

  const total = (order.totalAmount / 100).toFixed(2);
  
  const productsText = order.items.map(item => {
    let line = `• ${item.quantity}x ${item.name} (${(item.unitPrice / 100).toFixed(2)}€)`;
    if (item.description) line += `\n   → ${item.description}`;
    return line;
  }).join('\n');

  const message = `🏪 *COMMANDE SUR PLACE*

━━━━━━━━━━━━━━━━━━━
📋 *Commande #${order.orderId}*
💰 *Total: ${total}€*
💵 *PAIEMENT AU RETRAIT*
━━━━━━━━━━━━━━━━━━━

👤 *Client:* ${order.customerInfo.firstName} ${order.customerInfo.lastName}
📞 *Tél:* ${order.customerInfo.phone}
📧 *Email:* ${order.customerInfo.email}

━━━━━━━━━━━━━━━━━━━
🍽️ *DÉTAILS COMMANDE:*
━━━━━━━━━━━━━━━━━━━
${productsText}
━━━━━━━━━━━━━━━━━━━

${order.customerInfo.notes ? `📝 *Notes:* ${order.customerInfo.notes}\n` : ''}
⏰ ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`;

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
    throw new Error(`Twilio: ${JSON.stringify(result)}`);
  }
  return result;
}

// ============ EMAIL CLIENT ============
async function sendEmailToCustomer(order) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const total = (order.totalAmount / 100).toFixed(2);
  const customerEmail = order.customerInfo.email;
  if (!customerEmail) return;

  const productsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <strong>${item.name}</strong>
        ${item.description ? `<br><span style="color: #666; font-size: 13px;">${item.description}</span>` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${(item.unitPrice / 100).toFixed(2)}€</td>
    </tr>
  `).join('');

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 16px 16px 0 0; padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">🍔 DWICH62</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Confirmation de commande</p>
    </div>
    
    <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      
      <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 25px;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">Numéro de commande</p>
        <p style="margin: 5px 0 0 0; color: #d97706; font-size: 32px; font-weight: bold; letter-spacing: 2px;">#${order.orderId}</p>
      </div>
      
      <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin-bottom: 25px; text-align: center;">
        <p style="margin: 0; color: #1e40af; font-weight: bold;">🏪 RETRAIT SUR PLACE</p>
        <p style="margin: 5px 0 0 0; color: #1e3a8a;">Paiement à effectuer au retrait</p>
      </div>
      
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Bonjour <strong>${order.customerInfo.firstName}</strong>,<br><br>
        Merci pour votre commande ! Elle sera prête dans <strong>15-20 minutes</strong>.
      </p>
      
      <h2 style="color: #333; font-size: 18px; margin: 30px 0 15px 0; padding-bottom: 10px; border-bottom: 2px solid #f59e0b;">
        📋 Votre commande
      </h2>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9f9f9;">
            <th style="padding: 12px; text-align: left;">Produit</th>
            <th style="padding: 12px; text-align: center;">Qté</th>
            <th style="padding: 12px; text-align: right;">Prix</th>
          </tr>
        </thead>
        <tbody>${productsHtml}</tbody>
      </table>
      
      <div style="background: #f9f9f9; border-radius: 8px; padding: 15px; margin-top: 20px;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 10px 0; font-size: 20px; font-weight: bold;">Total à payer</td>
            <td style="padding: 10px 0; text-align: right; font-size: 24px; font-weight: bold; color: #f59e0b;">${total}€</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-top: 25px; padding: 20px; background: #f0fdf4; border-radius: 8px; text-align: center;">
        <h3 style="margin: 0 0 10px 0; color: #166534;">📍 Adresse du restaurant</h3>
        <p style="margin: 0; color: #15803d; font-weight: bold;">135 Ter Rue Jules Guesde, 62800 Liévin</p>
        <p style="margin: 10px 0 0 0; color: #166534;">📞 07 67 46 95 02</p>
      </div>
      
      ${order.customerInfo.notes ? `
      <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
        <p style="margin: 0; color: #666;"><strong>📝 Vos notes:</strong> ${order.customerInfo.notes}</p>
      </div>
      ` : ''}
      
    </div>
    
    <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
      <p style="margin: 0;">© ${new Date().getFullYear()} DWICH62</p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'DWICH62 <onboarding@resend.dev>',
      to: [customerEmail],
      subject: `✅ Commande #${order.orderId} - Retrait sur place - DWICH62`,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend: ${JSON.stringify(error)}`);
  }
  return response.json();
}

// ============ EMAIL RESTAURANT ============
async function sendEmailToRestaurant(order) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const restaurantEmail = process.env.RESTAURANT_EMAIL || 'dwich62bruay@gmail.com';
  const total = (order.totalAmount / 100).toFixed(2);

  const productsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;">${item.quantity}x ${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd;">${item.description || '-'}</td>
      <td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">${(item.unitPrice * item.quantity / 100).toFixed(2)}€</td>
    </tr>
  `).join('');

  const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 20px; background-color: #f5f5f5; font-family: Arial, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    
    <div style="background: #f59e0b; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🏪 COMMANDE SUR PLACE</h1>
    </div>
    
    <div style="background: #fef3c7; padding: 20px; text-align: center; border-bottom: 3px solid #f59e0b;">
      <p style="margin: 0; color: #666;">Commande</p>
      <p style="margin: 5px 0; color: #d97706; font-size: 36px; font-weight: bold;">#${order.orderId}</p>
      <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #16a34a;">${total}€</p>
      <p style="margin: 10px 0 0 0; background: #dc2626; color: white; display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold;">💵 PAIEMENT AU RETRAIT</p>
    </div>
    
    <div style="padding: 20px; background: #f9f9f9;">
      <h2 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">👤 CLIENT</h2>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 5px 0; color: #666;">Nom:</td>
          <td style="padding: 5px 0; font-weight: bold;">${order.customerInfo.firstName} ${order.customerInfo.lastName}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Téléphone:</td>
          <td style="padding: 5px 0; font-weight: bold;"><a href="tel:${order.customerInfo.phone}" style="color: #dc2626;">${order.customerInfo.phone}</a></td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #666;">Email:</td>
          <td style="padding: 5px 0;">${order.customerInfo.email}</td>
        </tr>
      </table>
    </div>
    
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
        <tbody>${productsHtml}</tbody>
        <tfoot>
          <tr style="background: #f59e0b; color: white;">
            <td colspan="2" style="padding: 15px; font-size: 18px; font-weight: bold;">TOTAL À ENCAISSER</td>
            <td style="padding: 15px; text-align: right; font-size: 24px; font-weight: bold;">${total}€</td>
          </tr>
        </tfoot>
      </table>
    </div>
    
    ${order.customerInfo.notes ? `
    <div style="padding: 20px; background: #fef3c7; border-top: 1px solid #f59e0b;">
      <h2 style="margin: 0 0 10px 0; color: #92400e; font-size: 16px;">📝 NOTES DU CLIENT</h2>
      <p style="margin: 0; color: #78350f; font-weight: bold;">${order.customerInfo.notes}</p>
    </div>
    ` : ''}
    
    <div style="padding: 15px; background: #333; text-align: center;">
      <p style="margin: 0; color: #999; font-size: 12px;">
        Commande reçue le ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
      </p>
    </div>
  </div>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'DWICH62 <onboarding@resend.dev>',
      to: [restaurantEmail],
      subject: `🏪 COMMANDE SUR PLACE #${order.orderId} - ${total}€ - À ENCAISSER`,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Resend: ${JSON.stringify(error)}`);
  }
  return response.json();
}
