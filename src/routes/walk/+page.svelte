<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { walk, currentUser, showEncounterModal, encounters } from '$lib/stores';
	import { startWalk, stopWalk, formatDuration, getCurrentPosition } from '$lib/geo';
	import { addEncounter, loadEncounters } from '$lib/encounters';

	let timer = $state('00:00');
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let map: any = null;
	let mapEl: HTMLDivElement | undefined = $state();
	let L: any = null;
	let marker: any = null;
	let pathLine: any = null;

	// Encounter form state
	let dogName = $state('');
	let friendliness = $state(3);
	let notes = $state('');
	let saving = $state(false);

	onMount(async () => {
		// Start timer if walk is active
		if ($walk.isWalking && $walk.startTime) {
			timerInterval = setInterval(() => {
				timer = formatDuration($walk.startTime!);
			}, 1000);
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

			// Try to get current position
			try {
				const geoPos = await getCurrentPosition();
				const { latitude, longitude } = geoPos.coords;
				map.setView([latitude, longitude], 16);
				marker.setLatLng([latitude, longitude]);
				walk.update(w => ({ ...w, currentLocation: { lat: latitude, lng: longitude } }));
			} catch { /* use default */ }
		}
	});

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

	function handleStartWalk() {
		startWalk();
		timerInterval = setInterval(() => {
			timer = formatDuration($walk.startTime!);
		}, 1000);
	}

	function handleStopWalk() {
		stopWalk();
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		timer = '00:00';
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
				const encIcon = L.divIcon({
					html: `<div style="font-size:20px">🐕</div>`,
					className: '', iconSize: [20, 20], iconAnchor: [10, 10]
				});
				L.marker([loc.lat, loc.lng], { icon: encIcon })
					.addTo(map)
					.bindPopup(`<b>${dogName}</b><br>${'🐾'.repeat(friendliness)}`);
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
		if (map) map.remove();
		if (typeof document !== 'undefined') {
			document.body.classList.remove('overflow-hidden');
		}
	});
</script>

<svelte:head>
	<title>HelloDog — Walk</title>
</svelte:head>

<div class="pb-safe min-h-screen">
	<div class="max-w-lg mx-auto">
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

		<div class="p-5 space-y-4">
			<!-- Walk Controls -->
			<div class="flex gap-3">
				{#if !$walk.isWalking}
					<button onclick={handleStartWalk} class="btn btn-primary flex-1 rounded-full gap-2 shadow-lg shadow-primary/20" id="btn-walk-start">
						🐕 Start Walk
					</button>
				{:else}
					<button onclick={handleStopWalk} class="btn btn-error flex-1 rounded-full gap-2" id="btn-walk-stop">
						⏹ Stop Walk
					</button>
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

			<!-- Recent encounters during this session -->
			{#if $encounters.length > 0}
				<div>
					<h3 class="text-sm font-semibold text-base-content/50 mb-2">Recent Logs</h3>
					<div class="space-y-2">
						{#each $encounters.slice(0, 3) as enc}
							<div class="glass-card p-3 flex items-center gap-3">
								<div class="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-sm">🐕</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium text-sm truncate">{enc.dogName}</div>
								</div>
								<div class="text-xs">{'🐾'.repeat(enc.friendliness)}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Encounter Modal -->
{#if $showEncounterModal}
	<div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4" onclick={() => showEncounterModal.set(false)}>
		<div class="bg-base-200 rounded-2xl w-full max-w-md p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-center justify-between">
				<h2 class="text-xl font-bold">Log Encounter 🐕</h2>
				<button onclick={() => showEncounterModal.set(false)} class="btn btn-ghost btn-sm btn-circle">✕</button>
			</div>

			<div class="form-control">
				<label class="label" for="enc-dog-name"><span class="label-text font-medium">Dog's name</span></label>
				<input type="text" id="enc-dog-name" bind:value={dogName} placeholder="e.g. Max" class="input input-bordered w-full bg-base-300/50 focus:border-primary" required />
			</div>

			<div class="form-control">
				<label class="label"><span class="label-text font-medium">Friendliness</span></label>
				<div class="flex items-center gap-1">
					{#each [1, 2, 3, 4, 5] as paw}
						<button onclick={() => friendliness = paw} class="btn btn-ghost btn-sm p-1 text-2xl transition-transform hover:scale-125 {friendliness >= paw ? 'paw-filled' : 'paw-empty'}">
							🐾
						</button>
					{/each}
					<span class="ml-2 text-sm text-base-content/50">{friendliness}/5</span>
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
