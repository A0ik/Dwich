/**
 * API Route: GET /api/get-checkout-session?session_id=xxx
 * Récupère les détails d'une session Stripe pour afficher le ticket
 */

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { session_id } = req.query;

  if (!session_id) {
    return res.status(400).json({ error: 'session_id is required' });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    res.status(200).json({
      id: session.id,
      amount_total: session.amount_total,
      customer_email: session.customer_email,
      payment_status: session.payment_status,
      metadata: session.metadata,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
}
