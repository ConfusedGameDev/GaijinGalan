# Configurar pagos con Stripe

Flujo completo: jugador pulsa nivel bloqueado → Stripe Payment Link → webhook en Vercel
→ desbloqueo escrito en Firestore → el juego lo ve al instante (listener en vivo).

**Empieza TODO en modo test** (interruptor "Test mode" arriba a la derecha del dashboard).
Cuando funcione, repites los pasos en modo live.

## 1. Crear los productos (dashboard → Product catalog → Add product)

| Producto | Precio |
|---|---|
| Gaijin Galán — Nivel N4 | $0.99 USD (one-off) |
| Gaijin Galán — Nivel N3 | $0.99 USD (one-off) |
| Gaijin Galán — Nivel N2 | $0.99 USD (one-off) |
| Gaijin Galán — Nivel N1 | $0.99 USD (one-off) |
| Gaijin Galán — Todos los niveles | $3.00 USD (one-off) |

## 2. Crear los Payment Links (Payments → Payment Links → New)

Para CADA producto:

1. Selecciona el producto → **Create link**.
2. **IMPORTANTE — metadata:** en las opciones del link (sección Metadata) añade:
   - clave: `level`  → valor: `N4` (o `N3`, `N2`, `N1`, `ALL` según el producto)
   
   Sin esto el webhook no sabe qué desbloquear.
3. Opcional: en "After payment" → redirect a tu URL del juego con mensaje de gracias.
4. Copia la URL (`https://buy.stripe.com/...`) y pégala en `index.html` → `STRIPE_LINKS`.

El juego añade solo `?client_reference_id=<uid>` a la URL — así el pago queda ligado
a la cuenta Firebase del jugador.

## 3. Service account de Firebase (para que el webhook escriba en Firestore)

1. Firebase console → ⚙️ Project settings → **Service accounts** → *Generate new private key*.
2. Se descarga un JSON. **NUNCA lo subas al repo.**
3. En Vercel → tu proyecto → Settings → **Environment Variables**, crea:
   - `FIREBASE_SERVICE_ACCOUNT` = el contenido COMPLETO del JSON (pégalo tal cual, en una línea)

## 4. Claves de Stripe en Vercel

En Stripe dashboard → Developers → API keys:

- `STRIPE_SECRET_KEY` = la **Secret key** (test: empieza con `sk_test_`)

## 5. Registrar el webhook

1. Stripe dashboard → Developers → **Webhooks** → Add endpoint.
2. URL: `https://TU-DOMINIO.vercel.app/api/stripe-webhook`
3. Eventos: selecciona solo **`checkout.session.completed`**.
4. Tras crearlo, copia el **Signing secret** (`whsec_...`) y añádelo en Vercel:
   - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
5. Redeploy en Vercel para que tome las variables.

## 6. Reglas de Firestore (añadir la colección entitlements)

Firebase console → Firestore → Rules, reemplaza por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /entitlements/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;   // SOLO el webhook (admin) escribe aquí
    }
  }
}
```

## 7. Probar (modo test)

1. `git push` (sube `api/stripe-webhook.js` y `package.json` — Vercel instala las dependencias solo).
2. Entra al juego con tu cuenta → pulsa un nivel bloqueado → se abre Stripe Checkout.
3. Tarjeta de prueba: `4242 4242 4242 4242`, cualquier fecha futura, cualquier CVC.
4. Al pagar: el webhook escribe en `entitlements/{tu-uid}` y el candado del nivel
   se abre EN VIVO en el juego (sin refrescar).
5. Verifica en Stripe → Developers → Webhooks → tu endpoint → "Events" que responde 200.

## 8. Pasar a producción

1. Apaga Test mode y repite pasos 1-2 y 5 en modo live (los links y el whsec_ cambian).
2. Sustituye en Vercel `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` por los live.
3. Sustituye las URLs live en `STRIPE_LINKS` de `index.html`.
4. Activa tu cuenta Stripe (datos fiscales/banco) para poder cobrar de verdad.

## Notas

- **Impuestos:** activa "Stripe Tax" en los Payment Links si vendes a UE/UK; Stripe
  calcula y cobra el IVA por ti (pequeña comisión extra).
- **Reembolsos:** si reembolsas, el desbloqueo NO se quita automáticamente; se puede
  añadir manejando el evento `charge.refunded` en el webhook más adelante.
- **Apps móviles futuras:** Apple/Google exigen compras in-app para contenido digital;
  el mismo documento `entitlements/{uid}` puede ser escrito por la verificación de IAP,
  así la web y las apps comparten desbloqueos.
