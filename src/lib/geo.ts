import { walk } from './stores';
import { get } from 'svelte/store';

let watchId: number | null = null;

export function getCurrentPosition(): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation not supported'));
			return;
		}
		navigator.geolocation.getCurrentPosition(resolve, reject, {
			enableHighAccuracy: true,
			timeout: 10000,
			maximumAge: 5000
		});
	});
}

export function startWatchingPosition(): void {
	if (!navigator.geolocation || watchId !== null) return;

	watchId = navigator.geolocation.watchPosition(
		(position) => {
			const { latitude, longitude } = position.coords;
			walk.update((w) => ({
				...w,
				currentLocation: { lat: latitude, lng: longitude },
				path: w.isWalking
					? [...w.path, { lat: latitude, lng: longitude, time: new Date() }]
					: w.path
			}));
		},
		(error) => {
			console.warn('Geo watch error:', error.message);
		},
		{
			enableHighAccuracy: true,
			timeout: 15000,
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

export function startWalk(): void {
	walk.set({
		isWalking: true,
		startTime: new Date(),
		currentLocation: get(walk).currentLocation,
		path: [],
		encountersDuringWalk: []
	});
	startWatchingPosition();
}

export function stopWalk(): void {
	stopWatchingPosition();
	walk.update((w) => ({
		...w,
		isWalking: false
	}));
}

export function formatDuration(startTime: Date): string {
	const diff = Date.now() - startTime.getTime();
	const mins = Math.floor(diff / 60000);
	const secs = Math.floor((diff % 60000) / 1000);
	return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
