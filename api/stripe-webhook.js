// Webhook de Stripe → escribe los desbloqueos en Firestore.
// Vercel lo expone automáticamente en /api/stripe-webhook
const Stripe = require('stripe');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  });
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Mapa producto → nivel (IDs del dashboard de Stripe)
const PRODUCT_LEVELS = {
  prod_UqtjYQzQZiKqio: 'N4',
  prod_Uqtk7fZtCV0bu8: 'N3',
  prod_UqtlMnNcQKZlbA: 'N2',
  prod_UqtlRy7mTyyvZB: 'N1',
  prod_UqtmM1DH4jbIgv: 'ALL',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  // cuerpo crudo: necesario para verificar la firma de Stripe
  let event;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    event = stripe.webhooks.constructEvent(
      raw,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Firma inválida:', err.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.client_reference_id; // uid de Firebase del jugador

    // 1) metadata.level si existe; 2) si no, se identifica por el producto comprado
    const levels = new Set();
    if (session.metadata && session.metadata.level) levels.add(session.metadata.level);
    if (!levels.size) {
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
      for (const item of items.data) {
        const lv = PRODUCT_LEVELS[item.price && item.price.product];
        if (lv) levels.add(lv);
      }
    }

    if (uid && levels.size) {
      const add = [];
      for (const lv of levels) {
        if (lv === 'ALL') add.push('N4', 'N3', 'N2', 'N1', 'ALL');
        else add.push(lv);
      }
      await admin.firestore().collection('entitlements').doc(uid).set(
        {
          unlocks: admin.firestore.FieldValue.arrayUnion(...add),
          lastPurchase: { levels: [...levels], session: session.id, at: Date.now() },
        },
        { merge: true }
      );
      console.log('Desbloqueado', add.join(','), 'para', uid);
    } else {
      console.warn('Sesión sin uid o sin producto reconocido:', session.id);
    }
  }

  res.status(200).json({ received: true });
};

module.exports.config = { api: { bodyParser: false } };
