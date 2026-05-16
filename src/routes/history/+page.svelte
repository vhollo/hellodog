<script lang="ts">
	import { encounters, currentUser } from '$lib/stores';
	import { loadEncounters } from '$lib/encounters';
	import EditEncounterModal from '$lib/components/EditEncounterModal.svelte';
	import type { Encounter } from '$lib/stores';
	import { onMount } from 'svelte';

	let filter = $state('');
	let editingEncounter: Encounter | null = $state(null);
	let view = $state<'list' | 'map'>('list');
	let mapEl: HTMLDivElement | undefined = $state();
	let map: any = null;

	let filtered = $derived(
		filter
			? $encounters.filter(e => e.dogName.toLowerCase().includes(filter.toLowerCase()))
			: $encounters
	);

	let grouped = $derived(() => {
		const groups = new Map<string, typeof $encounters>();
		for (const enc of filtered) {
			const key = enc.timestamp.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(enc);
		}
		return groups;
	});

	onMount(() => {
		if ($currentUser) loadEncounters($currentUser.uid);
	});

	async function initMap() {
		if (!mapEl || map) return;
		const L = await import('leaflet');
		map = L.map(mapEl).setView([47.5, 19.04], 12);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap', maxZoom: 19
		}).addTo(map);

		for (const enc of $encounters) {
			const icon = L.divIcon({
				html: `<div style="font-size:18px">🐕</div>`,
				className: '', iconSize: [18, 18], iconAnchor: [9, 9]
			});
			L.marker([enc.location.lat, enc.location.lng], { icon })
				.addTo(map)
				.bindPopup(`<b>${enc.dogName}</b><br>${'🐾'.repeat(enc.friendliness)}<br><small>${enc.timestamp.toLocaleString()}</small>`);
		}

		if ($encounters.length > 0) {
			const bounds = L.latLngBounds($encounters.map(e => [e.location.lat, e.location.lng]));
			map.fitBounds(bounds, { padding: [30, 30] });
		}
	}

	$effect(() => {
		if (view === 'map') {
			setTimeout(initMap, 100);
		}
	});

	function formatDate(d: Date): string {
		return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head><title>HelloDog — History</title></svelte:head>

<div class="pb-safe min-h-screen">
	<div class="p-5 pt-8 max-w-lg mx-auto space-y-4">
		<h1 class="text-2xl font-bold animate-fade-in">Encounter History</h1>

		<!-- Controls -->
		<div class="flex gap-2 animate-fade-in stagger-1">
			<input type="text" bind:value={filter} placeholder="Search dogs..." class="input input-bordered input-sm flex-1 bg-base-200/50" id="search-encounters" />
			<div class="join">
				<button class="join-item btn btn-sm {view === 'list' ? 'btn-primary' : 'btn-ghost'}" onclick={() => view = 'list'}>📋</button>
				<button class="join-item btn btn-sm {view === 'map' ? 'btn-primary' : 'btn-ghost'}" onclick={() => { view = 'map'; }}>🗺️</button>
			</div>
		</div>

		{#if view === 'map'}
			<div bind:this={mapEl} class="w-full h-80 map-container animate-fade-in"></div>
		{:else}
			{#if filtered.length === 0}
				<div class="glass-card p-8 text-center animate-fade-in">
					<div class="text-4xl mb-2">🔍</div>
					<p class="text-base-content/50">No encounters found</p>
				</div>
			{:else}
				{#each Array.from(grouped().entries()) as [date, encs], gi}
					<div class="animate-fade-in" style="animation-delay: {gi * 0.08}s; opacity: 0;">
						<h3 class="text-xs font-semibold text-base-content/40 uppercase tracking-wider mb-2">{date}</h3>
						<div class="space-y-2">
							{#each encs as enc}
								<button class="w-full text-left glass-card p-4 flex items-center gap-3 hover:bg-base-content/5 transition-colors" onclick={() => editingEncounter = enc}>
									<div class="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-lg shrink-0">🐕</div>
									<div class="flex-1 min-w-0">
										<div class="font-medium truncate">{enc.dogName}</div>
										<div class="text-xs text-base-content/40">{formatDate(enc.timestamp)}</div>
										{#if enc.notes}<div class="text-xs text-base-content/30 mt-0.5 truncate">{enc.notes}</div>{/if}
									</div>
									<div class="text-sm shrink-0">{'🐾'.repeat(enc.friendliness)}</div>
								</button>
							{/each}
						</div>
					</div>
				{/each}
			{/if}
		{/if}

		<div class="text-center text-xs text-base-content/30 py-2">
			{filtered.length} encounter{filtered.length !== 1 ? 's' : ''} total
		</div>
	</div>

	{#if editingEncounter}
		<EditEncounterModal
			encounter={editingEncounter}
			onClose={() => editingEncounter = null}
		/>
	{/if}
</div>
