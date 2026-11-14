# Swap Eat

Run from the repository root with `python -m http.server 8000`, then open `http://localhost:8000/dist/`.

## Firebase

1. Register a web app in the Swap Eat Firebase project. Paste the web SDK config object into `dist/firebase-config.js`, replacing `null`.
2. Enable Email/Password in Firebase Authentication. In Authentication → Settings → Authorized domains, add your deployed domain and `localhost` for local testing.
3. Create a Firestore database and deploy the bundled rules with `firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
4. Serve `dist/` from your static host, or run `firebase deploy --only hosting --project YOUR_PROJECT_ID` to use Firebase Hosting.

With a null config, the app runs an explicitly labeled, browser-local demo. Deal listings show a price and support pickup requests, with payment arranged between the two parties.
