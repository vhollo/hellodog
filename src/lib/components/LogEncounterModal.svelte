<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { walk, currentUser, showEncounterModal, encounters, userProfile } from '$lib/stores';
	import { addEncounter, loadEncounters } from '$lib/encounters';
	import { getAttitudeInfo } from '$lib/attitude';
	import { getCurrentPosition } from '$lib/geo';

	const DEFAULT_LOCATION = { lat: 47.5, lng: 19.04 };

	function formatLocalDateTime(date: Date): string {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - offset * 60 * 1000);
		return localDate.toISOString().slice(0, 16);
	}

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	let dogName = $state('');
	let friendliness = $state(3);
	let notes = $state('');
	let saving = $state(false);
	let error = $state('');

	let mapEl: HTMLDivElement | undefined = $state();
	let map: any = null;
	let L: any = null;
	let marker: any = null;
	let usedFallbackLocation = false;

	// Start from the last-known live location if we have one, else a neutral default
	// that we'll refine with a fresh GPS read once the modal is open.
	let encounterLocation = $state(
		$walk.currentLocation ? { ...$walk.currentLocation } : { ...DEFAULT_LOCATION }
	);
	let encounterTime = $state(formatLocalDateTime(new Date()));

	let uniqueDogNames = $derived(Array.from(new Set($encounters.map((e) => e.dogName))).sort());

	function iconHtml(f: number): string {
		const info = getAttitudeInfo(f);
		return `<div style="font-size: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center; cursor: grab;">
			<div>${info.emoji}</div>
			<div style="font-size: 14px; margin-top: -8px;">📍</div>
		</div>`;
	}

	function makeIcon(f: number) {
		return L.divIcon({ html: iconHtml(f), className: '', iconSize: [32, 42], iconAnchor: [16, 38] });
	}

	function close() {
		showEncounterModal.set(false);
	}

	onMount(() => {
		if (typeof document !== 'undefined') document.body.classList.add('overflow-hidden');

		usedFallbackLocation = !$walk.currentLocation;

		const timer = setTimeout(async () => {
			if (typeof window === 'undefined' || !mapEl) return;
			L = await import('leaflet');
			if (!mapEl) return;

			map = L.map(mapEl).setView([encounterLocation.lat, encounterLocation.lng], 16);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				attribution: '© OpenStreetMap',
				maxZoom: 19
			}).addTo(map);

			marker = L.marker([encounterLocation.lat, encounterLocation.lng], {
				icon: makeIcon(friendliness),
				draggable: true
			}).addTo(map);

			marker.on('dragend', () => {
				const latLng = marker.getLatLng();
				encounterLocation = { lat: latLng.lat, lng: latLng.lng };
			});

			map.invalidateSize();

			// If we started from the fallback (no live location yet), grab a fresh
			// fix so the pin lands where the user actually is.
			if (usedFallbackLocation) {
				try {
					const pos = await getCurrentPosition();
					const fresh = { lat: pos.coords.latitude, lng: pos.coords.longitude };
					encounterLocation = fresh;
					if (map && marker) {
						map.setView([fresh.lat, fresh.lng], 16);
						marker.setLatLng([fresh.lat, fresh.lng]);
					}
				} catch {
					/* keep the fallback location; user can drag the pin */
				}
			}
		}, 150);

		return () => clearTimeout(timer);
	});

	// Keep the pin emoji in sync with the chosen attitude
	$effect(() => {
		if (marker && L) marker.setIcon(makeIcon(friendliness));
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
		if (typeof document !== 'undefined') document.body.classList.remove('overflow-hidden');
	});

	async function handleLogEncounter() {
		if (!dogName.trim() || !$currentUser) return;
		saving = true;
		error = '';
		const loc = encounterLocation;
		const time = encounterTime ? new Date(encounterTime) : new Date();
		try {
			const id = await addEncounter($currentUser.uid, {
				dogName: dogName.trim(),
				friendliness,
				notes: notes.trim(),
				location: loc,
				timestamp: time,
				metUserId: null
			});
			await loadEncounters($currentUser.uid);

			// Track encounters that happen during an active walk so the live
			// walk stats reflect them.
			if ($walk.isWalking) {
				walk.update((w) => ({
					...w,
					encountersDuringWalk: [
						...w.encountersDuringWalk,
						{ id, dogName: dogName.trim(), friendliness, notes: notes.trim(), location: loc, timestamp: time, metUserId: null }
					]
				}));
			}

			close();
		} catch (e: any) {
			error = e?.message || 'Could not save. Please try again.';
		} finally {
			saving = false;
		}
	}
</script>

<div
	use:portal
	class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4"
	role="presentation"
	onclick={close}
>
	<div
		class="bg-base-200 rounded-2xl w-full max-w-md p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto"
		role="dialog"
		aria-modal="true"
		aria-label="Log a dog encounter"
		tabindex="-1"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.key === 'Escape' && close()}
	>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">Log Encounter 🐕</h2>
			<button onclick={close} class="btn btn-ghost btn-sm btn-circle" aria-label="Close">✕</button>
		</div>

		<div class="form-control">
			<label class="label" for="enc-dog-name"><span class="label-text font-medium">Dog's name</span></label>
			<input
				type="text"
				id="enc-dog-name"
				bind:value={dogName}
				list="dog-names-list"
				placeholder="e.g. Max"
				class="input input-bordered w-full bg-base-300/50 focus:border-primary"
				required
				autocomplete="off"
			/>
			<datalist id="dog-names-list">
				{#each uniqueDogNames as name (name)}
					<option value={name}></option>
				{/each}
			</datalist>
		</div>

		<div class="form-control">
			<span class="label"><span class="label-text font-medium">Location <span class="text-base-content/40">(drag pin to move)</span></span></span>
			<div bind:this={mapEl} class="w-full h-40 bg-base-300 rounded-xl overflow-hidden border border-base-content/10 shadow-inner"></div>
		</div>

		<div class="form-control">
			<label class="label" for="enc-time"><span class="label-text font-medium">Date & Time</span></label>
			<input type="datetime-local" id="enc-time" bind:value={encounterTime} class="input input-bordered w-full bg-base-300/50 focus:border-primary text-sm" required />
		</div>

		<div class="form-control">
			<span class="label"><span class="label-text font-medium">Attitude</span></span>
			<div class="flex items-center justify-between gap-1 w-full">
				{#each [1, 2, 3, 4, 5] as val (val)}
					{@const info = getAttitudeInfo(val)}
					<button
						type="button"
						onclick={() => (friendliness = val)}
						aria-pressed={friendliness === val}
						aria-label={info.text}
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

		{#if error}
			<p class="text-xs text-error">{error}</p>
		{/if}

		<button onclick={handleLogEncounter} disabled={!dogName.trim() || saving} class="btn btn-primary w-full rounded-full" id="btn-submit-encounter">
			{saving ? 'Saving...' : 'Save Encounter 🐾'}
		</button>
	</div>
</div>
