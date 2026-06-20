<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { walk, encounters, userProfile } from '$lib/stores';
	import { formatDuration, getCurrentPosition, pathDistanceMeters, formatDistance } from '$lib/geo';
	import { generatePredictions } from '$lib/encounters';
	import { getAttitudeInfo } from '$lib/attitude';

	let timer = $state('00:00');
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let map: any = null;
	let mapEl: HTMLDivElement | undefined = $state();
	let L: any = null;
	let marker: any = null;
	let pathLine: any = null;
	let heatmapLayer: any = null;
	let encounterLayer: any = null;
	const drawnEncounterIds = new Set<string>();

	// Live distance covered this walk, derived straight from the GPS path
	let distance = $derived(formatDistance(pathDistanceMeters($walk.path)));

	onMount(async () => {
		// Start timer if walk is already active (e.g. page revisit)
		if ($walk.isWalking && $walk.startTime) {
			startTimer();
		}

		// Init map
		if (typeof window !== 'undefined' && mapEl) {
			L = await import('leaflet');
			const pos = $walk.currentLocation || { lat: 47.5, lng: 19.04 };
			map = L.map(mapEl).setView([pos.lat, pos.lng], 15);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap',
				maxZoom: 19
			}).addTo(map);

			// Paw marker icon
			const pawIcon = L.divIcon({
				html: '<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">📍</div>',
				className: '',
				iconSize: [28, 28],
				iconAnchor: [14, 28]
			});

			marker = L.marker([pos.lat, pos.lng], { icon: pawIcon }).addTo(map);
			pathLine = L.polyline([], { color: '#f59e0b', weight: 4, opacity: 0.7 }).addTo(map);
			encounterLayer = L.layerGroup().addTo(map);

			// Show home radius on map if set
			if ($userProfile?.homeLocation) {
				const home = $userProfile.homeLocation;
				L.circle([home.lat, home.lng], {
					radius: 80,
					color: '#6366f1',
					fillColor: '#6366f1',
					fillOpacity: 0.08,
					weight: 2,
					opacity: 0.3,
					dashArray: '6, 8'
				}).addTo(map).bindPopup('🏠 Home zone');
			}

			// Try to get current position
			try {
				const geoPos = await getCurrentPosition();
				const { latitude, longitude } = geoPos.coords;
				map.setView([latitude, longitude], 16);
				marker.setLatLng([latitude, longitude]);
				walk.update((w) => ({ ...w, currentLocation: { lat: latitude, lng: longitude } }));
			} catch {
				/* use default */
			}
		}
	});

	// Watch walk state changes for timer
	$effect(() => {
		if ($walk.isWalking && $walk.startTime) {
			startTimer();
		} else {
			stopTimer();
		}
	});

	function startTimer() {
		if (timerInterval) return;
		timerInterval = setInterval(() => {
			if ($walk.startTime) timer = formatDuration($walk.startTime);
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		timer = '00:00';
	}

	// Watch walk state for map updates
	$effect(() => {
		if ($walk.currentLocation && marker && map) {
			marker.setLatLng([$walk.currentLocation.lat, $walk.currentLocation.lng]);
			map.panTo([$walk.currentLocation.lat, $walk.currentLocation.lng]);
		}
		if ($walk.path.length > 0 && pathLine) {
			pathLine.setLatLngs($walk.path.map((p) => [p.lat, p.lng]));
		}
	});

	// Drop a marker on the map for each encounter logged during this walk
	$effect(() => {
		if (!encounterLayer || !L) return;
		for (const enc of $walk.encountersDuringWalk) {
			const key = enc.id || `${enc.location.lat},${enc.location.lng},${enc.timestamp.getTime()}`;
			if (drawnEncounterIds.has(key)) continue;
			drawnEncounterIds.add(key);
			const att = getAttitudeInfo(enc.friendliness);
			const encIcon = L.divIcon({
				html: `<div style="font-size:20px">${att.emoji}</div>`,
				className: '',
				iconSize: [20, 20],
				iconAnchor: [10, 10]
			});
			L.marker([enc.location.lat, enc.location.lng], { icon: encIcon })
				.addTo(encounterLayer)
				.bindPopup(`<b>${enc.dogName}</b><br>${att.emoji} ${att.text}`);
		}
	});

	// Heatmap for probable friendly meetings
	$effect(() => {
		if ($walk.isWalking && map && L && $encounters.length > 0) {
			if (!heatmapLayer) {
				const preds = generatePredictions($encounters);
				// Filter for friendly meetings
				const friendlyPreds = preds.filter((p) => p.avgFriendliness >= 3);

				const circles = friendlyPreds.map((p) => {
					const att = getAttitudeInfo(p.avgFriendliness);
					return L.circle([p.bestLocation.lat, p.bestLocation.lng], {
						color: '#10b981',
						fillColor: '#10b981',
						fillOpacity: 0.2 + p.likelihood / 250,
						weight: 2,
						opacity: 0.6
					}).bindPopup(`<b>${p.dogName}</b><br>Likely to be here!<br>Attitude: ${att.emoji} ${att.text}`);
				});

				heatmapLayer = L.layerGroup(circles).addTo(map);
			}
		} else if (!$walk.isWalking && heatmapLayer && map) {
			map.removeLayer(heatmapLayer);
			heatmapLayer = null;
		}
	});

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
		if (map) map.remove();
	});
</script>

<div class="space-y-4">
	<!-- Map -->
	<div class="relative">
		<div bind:this={mapEl} class="w-full h-64 bg-base-200 map-container"></div>
		<!-- Walk status overlay -->
		{#if $walk.isWalking}
			<div class="absolute top-3 left-3 bg-base-100/90 backdrop-blur-md rounded-xl px-4 py-2 flex items-center gap-2">
				<div class="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></div>
				<span class="font-mono font-bold text-lg">{timer}</span>
			</div>
		{/if}
	</div>

	<!-- Walk path stats -->
	{#if $walk.isWalking}
		<div class="glass-card p-4 grid grid-cols-3 gap-4">
			<div>
				<div class="text-xs text-base-content/40">Duration</div>
				<div class="font-mono font-bold text-lg">{timer}</div>
			</div>
			<div>
				<div class="text-xs text-base-content/40">Distance</div>
				<div class="font-bold text-lg">{distance}</div>
			</div>
			<div>
				<div class="text-xs text-base-content/40">Encounters</div>
				<div class="font-bold text-lg">{$walk.encountersDuringWalk.length}</div>
			</div>
		</div>
	{/if}
</div>
