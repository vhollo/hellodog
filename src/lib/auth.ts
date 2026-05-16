import {
	signInWithPopup,
	signInWithRedirect,
	getRedirectResult,
	signInAnonymously,
	GoogleAuthProvider,
	signOut as firebaseSignOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import {
	doc,
	getDoc,
	setDoc,
	serverTimestamp
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import { currentUser, authLoading, userProfile, type UserProfile } from './stores';

const googleProvider = new GoogleAuthProvider();

function isMobile(): boolean {
	return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function initAuth(): void {
	const auth = getFirebaseAuth();

	// Handle redirect result on return from Google sign-in (mobile flow)
	getRedirectResult(auth).catch((err) => {
		console.error('Redirect sign-in error:', err);
	});

	onAuthStateChanged(auth, async (user) => {
		currentUser.set(user);
		if (user) {
			await loadUserProfile(user.uid);
		} else {
			userProfile.set(null);
		}
		authLoading.set(false);
	});
}

export async function signInWithGoogle(): Promise<void> {
	const auth = getFirebaseAuth();
	if (isMobile()) {
		await signInWithRedirect(auth, googleProvider);
	} else {
		await signInWithPopup(auth, googleProvider);
	}
}

export async function signInAnon(): Promise<void> {
	const auth = getFirebaseAuth();
	await signInAnonymously(auth);
}

export async function signOut(): Promise<void> {
	const auth = getFirebaseAuth();
	await firebaseSignOut(auth);
}

async function loadUserProfile(uid: string): Promise<void> {
	const db = getFirebaseDb();
	const docRef = doc(db, 'users', uid);
	const snap = await getDoc(docRef);
	if (snap.exists()) {
		const data = snap.data();
		userProfile.set({
			displayName: data.displayName,
			dogName: data.dogName,
			dogBreed: data.dogBreed || '',
			isPaid: data.isPaid || false,
			createdAt: data.createdAt?.toDate() || new Date()
		});
	} else {
		userProfile.set(null);
	}
}

export async function saveUserProfile(uid: string, profile: Omit<UserProfile, 'createdAt' | 'isPaid'>): Promise<void> {
	const db = getFirebaseDb();
	const docRef = doc(db, 'users', uid);
	await setDoc(docRef, {
		...profile,
		isPaid: false,
		createdAt: serverTimestamp()
	}, { merge: true });
	await loadUserProfile(uid);
}
