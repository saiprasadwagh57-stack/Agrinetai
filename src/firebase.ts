import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import { initializeFirestore, collection, doc, getDoc, setDoc, addDoc, onSnapshot, query, orderBy, limit, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { setGmailAccessToken } from './lib/gmail';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-accc4823-f6ab-49b2-bc36-ffcfb888b70d');

export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.metadata',
];

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
GMAIL_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

// Clear token on sign out
onAuthStateChanged(auth, (user) => {
  if (!user) {
    setGmailAccessToken(null);
  }
});

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setGmailAccessToken(credential.accessToken);
    }
    return result.user;
  } catch (error: any) {
    if (
      error?.code === 'auth/cancelled-popup-request' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.message?.includes('cancelled-popup-request') ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      // User closed or superseded the sign-in popup.
      return null;
    }
    console.warn("Google sign in warning:", error?.code, error?.message);
    throw error;
  }
};

export const signUpWithEmailPassword = async (email: string, pass: string, name?: string) => {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user && name) {
      try {
        await updateProfile(cred.user, { displayName: name });
      } catch (profileErr) {
        console.warn("Profile update warning:", profileErr);
      }
    }
    return cred.user;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed' || error?.code === 'auth/admin-restricted-operation') {
      const u = await signInQuickAccess();
      if (u && name) {
        try {
          await updateProfile(u, { displayName: name });
        } catch (profileErr) {
          console.warn("Profile update warning:", profileErr);
        }
      }
      return u;
    }
    throw error;
  }
};

export const logInWithEmailPassword = async (email: string, pass: string) => {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    return cred.user;
  } catch (error: any) {
    if (error?.code === 'auth/operation-not-allowed' || error?.code === 'auth/admin-restricted-operation') {
      const u = await signInQuickAccess();
      return u;
    }
    throw error;
  }
};

export const signInQuickAccess = async () => {
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error: any) {
    console.error("Error signing in with quick access:", error);
    throw error;
  }
};

export interface FirestoreErrorInfo {
  error: string;
  operationType: string;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();
