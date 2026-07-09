# Configurar Firebase para Gaijin Galán

El juego ya tiene todo el código de login y sincronización. Solo falta tu proyecto Firebase (~10 min, gratis).

## 1. Crear el proyecto

1. Ve a https://console.firebase.google.com → **Add project** → nómbralo (ej. `gaijin-galan`).
2. Google Analytics: opcional, puedes desactivarlo.

## 2. Registrar la app web

1. En la portada del proyecto: icono **`</>`** (Web) → nómbrala → **Register app**.
2. Copia el bloque `firebaseConfig`. Solo necesitas 3 valores: `apiKey`, `authDomain`, `projectId`.
3. Pégalos en `index.html` donde dice `PEGA_AQUI` (busca `FIREBASE_CONFIG`).

## 3. Activar Authentication

1. Menú **Build → Authentication → Get started**.
2. Pestaña **Sign-in method**:
   - **Google** → Enable → elige email de soporte → Save.
   - **Email/Password** → Enable, y activa también **Email link (passwordless sign-in)** → Save.
3. Pestaña **Settings → Authorized domains** → **Add domain** → añade tu dominio de Vercel (ej. `gaijin-galan.vercel.app`). `localhost` ya viene incluido.

## 4. Activar Firestore

1. **Build → Firestore Database → Create database** → Production mode → región cercana (ej. `us-east4`).
2. Pestaña **Rules**, reemplaza todo por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saves/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

3. **Publish**.

Con esto cada usuario solo puede leer/escribir SU partida.

## 5. Probar

1. Sube `index.html` a Vercel (git push).
2. Abre la URL → pantalla de bienvenida → **Continuar con Google**.
3. Juega unas cartas, abre la URL en otro dispositivo, inicia sesión → tu progreso aparece.

## Cómo funciona la sincronización

- El progreso se guarda SIEMPRE en localStorage (funciona offline).
- Con sesión iniciada, cada respuesta se sube a Firestore (con un retraso de 1.5 s para no saturar).
- Al iniciar sesión se comparan la partida local y la de la nube: gana la que tenga más repasos.
- "reiniciar progreso" borra ambas.

## Para la futura app móvil

El documento de guardado en Firestore (`saves/{uid}`) es JSON plano — la app Android/iOS
puede leer/escribir el mismo documento con los SDK nativos de Firebase y compartir cuenta
y progreso con la web sin cambios.
