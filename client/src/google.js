import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { api } from './api.js';
let ready;
export function prepareGoogleLogin() {
  ready ||= api('/auth/config').then(async config => {
    const auth=getAuth(initializeApp(config));
    await setPersistence(auth,inMemoryPersistence);
    return auth;
  }).catch(error=>{ready=null;throw error;});
  return ready;
}
export async function googleLogin(link=false) {
  const auth=await prepareGoogleLogin();
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  try {
    const result=await signInWithPopup(auth,provider);
    return await api('/session/google',{idToken:await result.user.getIdToken(),link});
  }catch(error){
    const messages={'auth/unauthorized-domain':'This address must be added to Firebase Authentication authorized domains.','auth/operation-not-allowed':'Enable Google sign-in in Firebase Authentication.','auth/popup-blocked':'Allow popups for this site, then try again.','auth/popup-closed-by-user':'Sign-in was cancelled.'};
    if(['auth/popup-closed-by-user','auth/popup-blocked','auth/operation-not-supported-in-this-environment'].includes(error.code))
      throw new Error('The Google sign-in window closed or could not open. Open this app in Chrome, Edge, or Safari, allow popups, and try again.');
    throw new Error(messages[error.code]||'Google sign-in could not finish. Check your connection and try again.');
  }finally{await signOut(auth).catch(()=>{});}
}
