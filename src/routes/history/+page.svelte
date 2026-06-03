<script lang="ts">
	import { encounters, currentUser } from '$lib/stores';
	import { loadEncounters } from '$lib/encounters';
	import EditEncounterModal from '$lib/components/EditEncounterModal.svelte';
	import { getAttitudeInfo } from '$lib/attitude';
	import type { Encounter } from '$lib/stores';
	import { onMount, onDestroy } from 'svelte';

	let filter = $state('');
	let editingEncounter: Encounter | null = $state(null);
	let view = $state<'list' | 'map'>('list');
	let mapEl: HTMLDivElement | undefined = $state();
	let map: any = $state(null);
	let markersGroup: any = $state(null);
	let L_Lib: any = $state(null);

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
		if (typeof window !== 'undefined') {
			(window as any).openEditEncounter = (id: string) => {
				const found = $encounters.find(e => e.id === id);
				if (found) editingEncounter = found;
			};
		}
		if ($currentUser) loadEncounters($currentUser.uid);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			delete (window as any).openEditEncounter;
		}
	});

	async function initMap() {
		if (!mapEl || map || view !== 'map') return;
		L_Lib = await import('leaflet');
		if (!mapEl || map || view !== 'map') return;
		map = L_Lib.map(mapEl).setView([47.5, 19.04], 12);
		L_Lib.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap', maxZoom: 19
		}).addTo(map);

		markersGroup = L_Lib.layerGroup().addTo(map);
	}

	$effect(() => {
		if (view === 'map') {
			const timer = setTimeout(initMap, 100);
			return () => {
				clearTimeout(timer);
				if (map) {
					map.remove();
					map = null;
					markersGroup = null;
					L_Lib = null;
				}
			};
		}
	});

	$effect(() => {
		const currentEncounters = filtered;
		if (!map || !markersGroup || !L_Lib) return;

		// Clear old markers
		markersGroup.clearLayers();

		const groupedByLocation = new Map<string, Encounter[]>();
		for (const enc of currentEncounters) {
			const key = `${enc.location.lat.toFixed(5)},${enc.location.lng.toFixed(5)}`;
			if (!groupedByLocation.has(key)) {
				groupedByLocation.set(key, []);
			}
			groupedByLocation.get(key)!.push(enc);
		}

		for (const [coordStr, encs] of groupedByLocation.entries()) {
			const [lat, lng] = coordStr.split(',').map(Number);
			encs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
			
			const latestEnc = encs[0];
			const att = getAttitudeInfo(latestEnc.friendliness);
			
			let popupContent = '';
			if (encs.length === 1) {
				popupContent = `<a href="javascript:void(0)" onclick="openEditEncounter('${latestEnc.id}')" style="font-weight: bold; text-decoration: underline; color: var(--color-primary); cursor: pointer;">${latestEnc.dogName}</a><br>${att.emoji} ${att.text}<br><small>${latestEnc.timestamp.toLocaleString('en-US', { hour12: false })}</small>`;
			} else {
				popupContent = `<div style="max-height: 180px; overflow-y: auto; padding-right: 4px;">`;
				popupContent += `<div style="font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 6px;">${encs.length} Meets Here</div>`;
				for (const enc of encs) {
					const curAtt = getAttitudeInfo(enc.friendliness);
					popupContent += `
						<div style="margin-bottom: 8px; border-bottom: 1px dashed #eee; padding-bottom: 4px;">
							<a href="javascript:void(0)" onclick="openEditEncounter('${enc.id}')" style="font-weight: bold; text-decoration: underline; color: var(--color-primary); cursor: pointer;">${enc.dogName}</a><br>
							${curAtt.emoji} ${curAtt.text}<br>
							<small style="color: #666;">${enc.timestamp.toLocaleString('en-US', { hour12: false })}</small>
						</div>
					`;
				}
				popupContent += `</div>`;
			}

			let htmlContent = `<div style="position: relative; font-size: 18px;">${att.emoji}`;
			if (encs.length > 1) {
				htmlContent += `<span style="position: absolute; top: -6px; right: -6px; background: #ef4444; color: white; font-size: 8px; font-weight: bold; border-radius: 9999px; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid white; line-height: 1;">${encs.length}</span>`;
			}
			htmlContent += `</div>`;

			const icon = L_Lib.divIcon({
				html: htmlContent,
				className: '', iconSize: [18, 18], iconAnchor: [9, 9]
			});

			L_Lib.marker([lat, lng], { icon })
				.addTo(markersGroup)
				.bindPopup(popupContent);
		}

		if (currentEncounters.length > 0) {
			const bounds = L_Lib.latLngBounds(currentEncounters.map(e => [e.location.lat, e.location.lng]));
			map.fitBounds(bounds, { padding: [30, 30] });
		}
	});

	function formatDate(d: Date): string {
		return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
									<div class="text-xl shrink-0" title={getAttitudeInfo(enc.friendliness).text}>{getAttitudeInfo(enc.friendliness).emoji}</div>
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
