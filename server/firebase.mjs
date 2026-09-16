import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function publicFirebaseConfig() {
  return Object.fromEntries(Object.entries({apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',appId:'APP_ID'}).map(([key, suffix]) => [key, process.env['FIREBASE_' + suffix]]));
}
export function firebaseAuth() {
  const app = getApps()[0] || initializeApp({credential:cert({
    projectId:process.env.FIREBASE_PROJECT_ID,
    clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
    privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  })});
  return getAuth(app);
}
export const verifyGoogleToken = token => firebaseAuth().verifyIdToken(token, true);
