import { walk, userProfile } from './stores';
import { get } from 'svelte/store';

let watchId: number | null = null;

// ──────────────────────────────────────────
// Geofence & auto-stop configuration
// ──────────────────────────────────────────
const HOME_RADIUS_M = 80;                     // meters from home to trigger start/stop
const STATIONARY_TIMEOUT_MS = 5 * 60 * 1000;  // 5 min with no movement → auto-stop
const BACKGROUND_TIMEOUT_MS = 10 * 60 * 1000; // 10 min in background → auto-stop
const MOVEMENT_THRESHOLD_M = 15;              // minimum meters to count as "moved"

let lastMovedAt: number = Date.now();
let lastSignificantLat: number | null = null;
let lastSignificantLng: number | null = null;
let stationaryCheckInterval: ReturnType<typeof setInterval> | null = null;
let backgroundedAt: number | null = null;
let visibilityHandler: (() => void) | null = null;

// ──────────────────────────────────────────
// Geolocation utilities
// ──────────────────────────────────────────

export function getCurrentPosition(): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation not supported'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, {
			enableHighAccuracy: true,
			timeout: 30000,
			maximumAge: 5000
		});
	});
}

/** Haversine distance in meters between two lat/lng points */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371000;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a = Math.sin(dLat / 2) ** 2
		+ Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ──────────────────────────────────────────
// Geofence — auto-start / auto-stop
// ──────────────────────────────────────────

/** Check if current position is inside the home geofence */
function isInsideHome(lat: number, lng: number): boolean {
	const profile = get(userProfile);
	if (!profile?.homeLocation) return false;
	return distanceMeters(profile.homeLocation.lat, profile.homeLocation.lng, lat, lng) < HOME_RADIUS_M;
}

function handleGeofence(lat: number, lng: number): void {
	const profile = get(userProfile);
	if (!profile?.homeLocation) return;

	const w = get(walk);
	const atHome = isInsideHome(lat, lng);

	if (!w.isWalking && !atHome) {
		// Left home → auto-start walk
		console.log('[Walk] Auto-starting: left home geofence');
		startWalk('geofence');
	} else if (w.isWalking && atHome) {
		// Returned home → auto-stop walk
		console.log('[Walk] Auto-stopping: returned to home geofence');
		stopWalk('home');
	}
}

// ──────────────────────────────────────────
// Position watching (always-on when app is open)
// ──────────────────────────────────────────

export function startWatchingPosition(): void {
	if (!navigator.geolocation || watchId !== null) return;

	watchId = navigator.geolocation.watchPosition(
		(position) => {
			const { latitude, longitude } = position.coords;

			// Track significant movement for auto-stop
			if (lastSignificantLat !== null && lastSignificantLng !== null) {
				const dist = distanceMeters(lastSignificantLat, lastSignificantLng, latitude, longitude);
				if (dist >= MOVEMENT_THRESHOLD_M) {
					lastMovedAt = Date.now();
					lastSignificantLat = latitude;
					lastSignificantLng = longitude;
				}
			} else {
				lastSignificantLat = latitude;
				lastSignificantLng = longitude;
				lastMovedAt = Date.now();
			}

			walk.update((w) => ({
				...w,
				currentLocation: { lat: latitude, lng: longitude },
				path: w.isWalking
					? [...w.path, { lat: latitude, lng: longitude, time: new Date() }]
					: w.path
			}));

			// Check geofence
			handleGeofence(latitude, longitude);
		},
		(error) => {
			console.error('Geo watch error:', error.code, error.message);
			if (error.code === 1) {
				alert("Location access denied. Please enable Location Services for Safari in iOS Settings.");
			}
		},
		{
			enableHighAccuracy: true,
			timeout: 30000,
			maximumAge: 5000
		}
	);
}

export function stopWatchingPosition(): void {
	if (watchId !== null) {
		navigator.geolocation.clearWatch(watchId);
		watchId = null;
	}
}

// ──────────────────────────────────────────
// Auto-stop: stationary detection
// ──────────────────────────────────────────

function startStationaryCheck(): void {
	if (stationaryCheckInterval) return;

	stationaryCheckInterval = setInterval(() => {
		const w = get(walk);
		if (!w.isWalking) return;

		const idleDuration = Date.now() - lastMovedAt;
		if (idleDuration >= STATIONARY_TIMEOUT_MS) {
			console.log(`[Walk] Auto-stopping: stationary for ${Math.round(idleDuration / 60000)}min`);
			stopWalk('stationary');
		}
	}, 30_000); // check every 30s
}

function stopStationaryCheck(): void {
	if (stationaryCheckInterval) {
		clearInterval(stationaryCheckInterval);
		stationaryCheckInterval = null;
	}
}

// ──────────────────────────────────────────
// Auto-stop: background/visibility detection
// ──────────────────────────────────────────

function startVisibilityWatch(): void {
	if (typeof document === 'undefined' || visibilityHandler) return;

	visibilityHandler = () => {
		if (document.hidden) {
			backgroundedAt = Date.now();
		} else {
			// App came back to foreground
			if (backgroundedAt !== null) {
				const bgDuration = Date.now() - backgroundedAt;
				backgroundedAt = null;

				const w = get(walk);
				if (w.isWalking && bgDuration >= BACKGROUND_TIMEOUT_MS) {
					console.log(`[Walk] Auto-stopping: backgrounded for ${Math.round(bgDuration / 60000)}min`);
					stopWalk('background');
				}
			}
		}
	};

	document.addEventListener('visibilitychange', visibilityHandler);
}

function stopVisibilityWatch(): void {
	if (visibilityHandler && typeof document !== 'undefined') {
		document.removeEventListener('visibilitychange', visibilityHandler);
		visibilityHandler = null;
	}
	backgroundedAt = null;
}

// ──────────────────────────────────────────
// Walk lifecycle
// ──────────────────────────────────────────

export type StopReason = 'manual' | 'stationary' | 'background' | 'home';
export type StartReason = 'manual' | 'geofence';

let onAutoStopCallback: ((reason: StopReason) => void) | null = null;
let onAutoStartCallback: ((reason: StartReason) => void) | null = null;

/** Register a callback to be notified when a walk is auto-stopped */
export function onAutoStop(cb: (reason: StopReason) => void): void {
	onAutoStopCallback = cb;
}

/** Register a callback to be notified when a walk is auto-started */
export function onAutoStart(cb: (reason: StartReason) => void): void {
	onAutoStartCallback = cb;
}

export function startWalk(reason: StartReason = 'manual'): void {
	const current = get(walk);
	if (current.isWalking) return; // already walking

	lastMovedAt = Date.now();
	lastSignificantLat = current.currentLocation?.lat ?? null;
	lastSignificantLng = current.currentLocation?.lng ?? null;

	walk.set({
		isWalking: true,
		startTime: new Date(),
		currentLocation: current.currentLocation,
		path: [],
		encountersDuringWalk: []
	});

	startStationaryCheck();
	startVisibilityWatch();

	if (reason !== 'manual' && onAutoStartCallback) {
		onAutoStartCallback(reason);
	}
}

export function stopWalk(reason: StopReason = 'manual'): void {
	stopStationaryCheck();
	stopVisibilityWatch();

	walk.update((w) => ({
		...w,
		isWalking: false
	}));

	if (reason !== 'manual' && onAutoStopCallback) {
		onAutoStopCallback(reason);
	}
}

/** Initialize passive geofence monitoring — call once on app boot */
export function initGeofenceMonitoring(): void {
	// Start watching position for geofence checks
	// Position updates will trigger handleGeofence()
	startWatchingPosition();
	startVisibilityWatch();
}

export function formatDuration(startTime: Date): string {
	const diff = Date.now() - startTime.getTime();
	const mins = Math.floor(diff / 60000);
	const secs = Math.floor((diff % 60000) / 1000);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
