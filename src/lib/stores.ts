import { writable, derived } from 'svelte/store';
import type { User } from 'firebase/auth';

// ──────────────────────────────────────────
// Auth state
// ──────────────────────────────────────────
export const currentUser = writable<User | null>(null);
export const authLoading = writable(true);
export const isLoggedIn = derived(currentUser, ($u) => $u !== null);

// ──────────────────────────────────────────
// User profile (Firestore doc)
// ──────────────────────────────────────────
export interface UserProfile {
	displayName: string;
	dogName: string;
	dogBreed?: string;
	isPaid: boolean;
	createdAt: Date;
}

export const userProfile = writable<UserProfile | null>(null);

// ──────────────────────────────────────────
// Encounter types
// ──────────────────────────────────────────
export interface Encounter {
	id?: string;
	dogName: string;
	friendliness: number; // 1-5
	notes?: string;
	location: { lat: number; lng: number };
	timestamp: Date;
	metUserId?: string | null;
}

export const encounters = writable<Encounter[]>([]);

// ──────────────────────────────────────────
// Walk state
// ──────────────────────────────────────────
export interface WalkState {
	isWalking: boolean;
	startTime: Date | null;
	currentLocation: { lat: number; lng: number } | null;
	path: Array<{ lat: number; lng: number; time: Date }>;
	encountersDuringWalk: Encounter[];
}

export const walk = writable<WalkState>({
	isWalking: false,
	startTime: null,
	currentLocation: null,
	path: [],
	encountersDuringWalk: []
});

// ──────────────────────────────────────────
// Predictions
// ──────────────────────────────────────────
export interface Prediction {
	dogName: string;
	likelihood: number; // 0-100%
	bestTime: string;
	bestLocation: { lat: number; lng: number };
	avgFriendliness: number;
	totalMeets: number;
	basedOnUsers?: number; // paid tier: how many other users' data
}

export const predictions = writable<Prediction[]>([]);

// ──────────────────────────────────────────
// UI state
// ──────────────────────────────────────────
export const activeTab = writable<'home' | 'walk' | 'history' | 'predictions' | 'settings'>('home');
export const showEncounterModal = writable(false);
