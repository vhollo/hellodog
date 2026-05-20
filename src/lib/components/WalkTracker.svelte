<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { walk, currentUser, showEncounterModal, encounters, userProfile } from '$lib/stores';
	import { startWalk, stopWalk, formatDuration, getCurrentPosition, initGeofenceMonitoring, onAutoStop, onAutoStart, type StopReason, type StartReason } from '$lib/geo';
	import { addEncounter, loadEncounters, generatePredictions } from '$lib/encounters';
	import { getAttitudeInfo } from '$lib/attitude';

	let timer = $state('00:00');
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let map: any = null;
	let mapEl: HTMLDivElement | undefined = $state();
	let L: any = null;
	let marker: any = null;
	let pathLine: any = null;
	let heatmapLayer: any = null;

	// Encounter form state
	let dogName = $state('');
	let friendliness = $state(3);
	let notes = $state('');
	let saving = $state(false);

	// Auto walk status toast
	let statusToast = $state('');
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	function showToast(message: string) {
		statusToast = message;
		if (toastTimeout) clearTimeout(toastTimeout);
		toastTimeout = setTimeout(() => { statusToast = ''; }, 4000);
	}

	// Action to teleport modal to body to escape CSS transform containing blocks
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	let uniqueDogNames = $derived(
		Array.from(new Set($encounters.map(e => e.dogName))).sort()
	);

	let hasHome = $derived(!!$userProfile?.homeLocation);

	onMount(async () => {
		// Register auto-start/stop callbacks
		onAutoStart((reason: StartReason) => {
			if (reason === 'geofence') {
				showToast('🐕 Walk started — you left home!');
			}
			startTimer();
		});

		onAutoStop((reason: StopReason) => {
			stopTimer();
			const msgs: Record<string, string> = {
				home: '🏠 Walk ended — welcome home!',
				stationary: '⏸️ Walk ended — you were stationary',
				background: '📱 Walk ended — app was in background'
			};
			showToast(msgs[reason] || 'Walk ended');
		});

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
				walk.update(w => ({ ...w, currentLocation: { lat: latitude, lng: longitude } }));
			} catch { /* use default */ }
		}

		// Initialize geofence monitoring (passive GPS watching)
		initGeofenceMonitoring();
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
			pathLine.setLatLngs($walk.path.map(p => [p.lat, p.lng]));
		}
	});

	// Heatmap for probable friendly meetings
	$effect(() => {
		if ($walk.isWalking && map && L && $encounters.length > 0) {
			if (!heatmapLayer) {
				const preds = generatePredictions($encounters);
				// Filter for friendly meetings
				const friendlyPreds = preds.filter(p => p.avgFriendliness >= 3);
				
				const circles = friendlyPreds.map(p => {
					const radius = 60 + (p.likelihood / 2); // 60-110m radius based on likelihood
					const att = getAttitudeInfo(p.avgFriendliness);
					return L.circle([p.bestLocation.lat, p.bestLocation.lng], {
						color: '#10b981', // Tailwind success/emerald
						fillColor: '#10b981',
						fillOpacity: 0.2 + (p.likelihood / 250), // Opacity scales with likelihood
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

	// Prevent background scrolling when modal is open
	$effect(() => {
		if (typeof document !== 'undefined') {
			if ($showEncounterModal) {
				document.body.classList.add('overflow-hidden');
			} else {
				document.body.classList.remove('overflow-hidden');
			}
		}
	});

	function handleManualStart() {
		startWalk('manual');
		startTimer();
	}

	function handleManualStop() {
		stopWalk('manual');
		stopTimer();
	}

	async function handleLogEncounter() {
		if (!dogName.trim() || !$currentUser) return;
		saving = true;
		const loc = $walk.currentLocation || { lat: 0, lng: 0 };
		try {
			await addEncounter($currentUser.uid, {
				dogName: dogName.trim(),
				friendliness,
				notes: notes.trim(),
				location: loc,
				timestamp: new Date(),
				metUserId: null
			});
			await loadEncounters($currentUser.uid);

			// Add encounter marker on map
			if (map && L) {
				const att = getAttitudeInfo(friendliness);
				const encIcon = L.divIcon({
					html: `<div style="font-size:20px">${att.emoji}</div>`,
					className: '', iconSize: [20, 20], iconAnchor: [10, 10]
				});
				L.marker([loc.lat, loc.lng], { icon: encIcon })
					.addTo(map)
					.bindPopup(`<b>${dogName}</b><br>${att.emoji} ${att.text}`);
			}

			// Reset form
			dogName = '';
			friendliness = 3;
			notes = '';
			showEncounterModal.set(false);
		} finally {
			saving = false;
		}
	}

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
		if (toastTimeout) clearTimeout(toastTimeout);
		if (map) map.remove();
		if (typeof document !== 'undefined') {
			document.body.classList.remove('overflow-hidden');
		}
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
		{:else if hasHome}
			<div class="absolute top-3 left-3 bg-base-100/80 backdrop-blur-md rounded-xl px-3 py-1.5 flex items-center gap-2">
				<div class="w-2 h-2 rounded-full bg-base-content/20"></div>
				<span class="text-xs text-base-content/50 font-medium">At home · walk starts when you leave</span>
			</div>
		{/if}

		<!-- Toast notification -->
		{#if statusToast}
			<div class="absolute bottom-3 left-3 right-3 bg-base-100/95 backdrop-blur-md rounded-xl px-4 py-3 text-sm font-medium text-center animate-slide-up shadow-lg">
				{statusToast}
			</div>
		{/if}
	</div>

	<!-- Walk Controls -->
	<div class="flex gap-3">
		{#if !hasHome}
			<!-- No home set: show manual controls -->
			{#if !$walk.isWalking}
				<button onclick={handleManualStart} class="btn btn-primary flex-1 rounded-full gap-2 shadow-lg shadow-primary/20" id="btn-walk-start">
					🐕 Start Walk
				</button>
			{:else}
				<button onclick={handleManualStop} class="btn btn-error flex-1 rounded-full gap-2" id="btn-walk-stop">
					⏹ Stop Walk
				</button>
			{/if}
		{:else}
			<!-- Home is set: show auto-walk status -->
			{#if $walk.isWalking}
				<div class="flex-1 flex items-center gap-3 px-4">
					<div class="w-2.5 h-2.5 rounded-full bg-success animate-pulse shrink-0"></div>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold">Walking</div>
						<div class="text-[10px] text-base-content/40">Auto-stops at home or after 5 min idle</div>
					</div>
					<button onclick={handleManualStop} class="btn btn-ghost btn-sm btn-circle text-error" id="btn-walk-stop" title="End walk now">
						⏹
					</button>
				</div>
			{:else}
				<div class="flex-1 flex items-center gap-3 px-4">
					<div class="text-lg">🏠</div>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium text-base-content/60">Ready to walk</div>
						<div class="text-[10px] text-base-content/40">Walk starts automatically when you leave home</div>
					</div>
				</div>
			{/if}
		{/if}
		<button onclick={() => showEncounterModal.set(true)} class="btn btn-secondary rounded-full gap-2 shadow-lg shadow-secondary/20" id="btn-log-encounter">
			✍️ Log Meet
		</button>
	</div>

	<!-- Walk path stats -->
	{#if $walk.isWalking}
		<div class="glass-card p-4 grid grid-cols-2 gap-4">
			<div><div class="text-xs text-base-content/40">Duration</div><div class="font-mono font-bold text-lg">{timer}</div></div>
			<div><div class="text-xs text-base-content/40">Encounters</div><div class="font-bold text-lg">{$walk.encountersDuringWalk.length}</div></div>
		</div>
	{/if}
</div>

<!-- Encounter Modal -->
{#if $showEncounterModal}
	<div use:portal class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4" onclick={() => showEncounterModal.set(false)}>
		<div class="bg-base-200 rounded-2xl w-full max-w-md p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-bold">Log Encounter 🐕</h2>
				<button onclick={() => showEncounterModal.set(false)} class="btn btn-ghost btn-sm btn-circle">✕</button>
			</div>

			<div class="form-control">
				<label class="label" for="enc-dog-name"><span class="label-text font-medium">Dog's name</span></label>
				<input type="text" id="enc-dog-name" bind:value={dogName} list="dog-names-list" placeholder="e.g. Max" class="input input-bordered w-full bg-base-300/50 focus:border-primary" required autocomplete="off" />
				<datalist id="dog-names-list">
					{#each uniqueDogNames as name}
						<option value={name}></option>
					{/each}
				</datalist>
			</div>

			<div class="form-control">
				<label class="label" for="enc-attitude"><span class="label-text font-medium">Attitude</span></label>
				<div class="flex items-center justify-between gap-1 w-full" id="enc-attitude">
					{#each [1, 2, 3, 4, 5] as val}
						{@const info = getAttitudeInfo(val)}
						<button
							type="button"
							onclick={() => friendliness = val}
							class="flex flex-col flex-1 items-center justify-center p-2 rounded-xl border-2 transition-all hover:scale-105 {friendliness === val ? 'border-primary bg-primary/10' : 'border-transparent bg-base-300/50 grayscale opacity-50'}"
						>
							<span class="text-2xl">{info.emoji}</span>
							<span class="text-[10px] text-center mt-1 leading-tight">{info.text}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="form-control">
				<label class="label" for="enc-notes"><span class="label-text font-medium">Notes <span class="text-base-content/40">(optional)</span></span></label>
				<textarea id="enc-notes" bind:value={notes} placeholder="Playful, loves fetch..." class="textarea textarea-bordered bg-base-300/50 focus:border-primary" rows="2"></textarea>
			</div>

			<button onclick={handleLogEncounter} disabled={!dogName.trim() || saving} class="btn btn-primary w-full rounded-full" id="btn-submit-encounter">
				{saving ? 'Saving...' : 'Save Encounter 🐾'}
			</button>
		</div>
	</div>
{/if}
