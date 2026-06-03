<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { updateEncounter, loadEncounters } from '$lib/encounters';
	import { currentUser, type Encounter } from '$lib/stores';
	import { getAttitudeInfo } from '$lib/attitude';

	let { encounter, onClose } = $props<{ encounter: Encounter; onClose: () => void }>();

	function formatLocalDateTime(date: Date): string {
		const offset = date.getTimezoneOffset();
		const localDate = new Date(date.getTime() - (offset * 60 * 1000));
		return localDate.toISOString().slice(0, 16);
	}

	// Capture static snapshot at instantiation to prevent Svelte compiler props warning
	const initialEncounter = encounter;

	let dogName = $state(initialEncounter.dogName);
	let friendliness = $state(initialEncounter.friendliness);
	let notes = $state(initialEncounter.notes || '');
	let saving = $state(false);

	let mapEl: HTMLDivElement | undefined = $state();
	let map: any = null;
	let L: any = null;
	let marker: any = null;
	let editedLocation = $state({ lat: initialEncounter.location.lat, lng: initialEncounter.location.lng });
	let encounterTime = $state(formatLocalDateTime(initialEncounter.timestamp));

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	onMount(() => {
		const timer = setTimeout(async () => {
			if (typeof window !== 'undefined' && mapEl) {
				L = await import('leaflet');
				if (!mapEl) return;
				
				map = L.map(mapEl).setView([editedLocation.lat, editedLocation.lng], 16);
				L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '© OpenStreetMap',
					maxZoom: 19
				}).addTo(map);

				const getIconHtml = (f: number) => {
					const info = getAttitudeInfo(f);
					return `<div style="font-size: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center; cursor: grab;">
						<div>${info.emoji}</div>
						<div style="font-size: 14px; margin-top: -8px;">📍</div>
					</div>`;
				};

				const createIcon = (f: number) => {
					return L.divIcon({
						html: getIconHtml(f),
						className: '',
						iconSize: [32, 42],
						iconAnchor: [16, 38]
					});
				};

				marker = L.marker([editedLocation.lat, editedLocation.lng], {
					icon: createIcon(friendliness),
					draggable: true
				}).addTo(map);

				marker.on('dragend', () => {
					const latLng = marker.getLatLng();
					editedLocation = { lat: latLng.lat, lng: latLng.lng };
				});
				
				// Ensure correct size calculations after render/animation
				map.invalidateSize();
			}
		}, 150);

		return () => {
			clearTimeout(timer);
		};
	});

	$effect(() => {
		if (marker && L) {
			const getIconHtml = (f: number) => {
				const info = getAttitudeInfo(f);
				return `<div style="font-size: 26px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); display: flex; flex-direction: column; align-items: center; cursor: grab;">
					<div>${info.emoji}</div>
					<div style="font-size: 14px; margin-top: -8px;">📍</div>
				</div>`;
			};
			const newIcon = L.divIcon({
				html: getIconHtml(friendliness),
				className: '',
				iconSize: [32, 42],
				iconAnchor: [16, 38]
			});
			marker.setIcon(newIcon);
		}
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
	});

	async function handleSave() {
		if (!dogName.trim() || !$currentUser) return;
		saving = true;
		try {
			await updateEncounter($currentUser.uid, initialEncounter.id, {
				dogName: dogName.trim(),
				friendliness,
				notes: notes.trim(),
				location: editedLocation,
				timestamp: new Date(encounterTime)
			});
			await loadEncounters($currentUser.uid);
			onClose();
		} finally {
			saving = false;
		}
	}
</script>

<div use:portal class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4" onclick={onClose}>
	<div class="bg-base-200 rounded-2xl w-full max-w-md p-6 space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto" onclick={(e) => e.stopPropagation()}>
		<div class="flex items-center justify-between">
			<h2 class="text-xl font-bold">Edit Meet 🐕</h2>
			<button onclick={onClose} class="btn btn-ghost btn-sm btn-circle">✕</button>
		</div>

		<div class="form-control">
			<label class="label" for="edit-dog-name"><span class="label-text font-medium">Dog's name</span></label>
			<input type="text" id="edit-dog-name" bind:value={dogName} placeholder="e.g. Max" class="input input-bordered w-full bg-base-300/50 focus:border-primary" required />
		</div>

		<div class="form-control">
			<label class="label"><span class="label-text font-medium">Location <span class="text-base-content/40">(drag pin to move)</span></span></label>
			<div bind:this={mapEl} class="w-full h-40 bg-base-300 rounded-xl overflow-hidden border border-base-content/10 shadow-inner"></div>
		</div>

		<div class="form-control">
			<label class="label" for="edit-time"><span class="label-text font-medium">Date & Time</span></label>
			<input type="datetime-local" id="edit-time" bind:value={encounterTime} class="input input-bordered w-full bg-base-300/50 focus:border-primary text-sm" required />
		</div>

		<div class="form-control">
			<label class="label"><span class="label-text font-medium">Attitude</span></label>
			<div class="flex items-center justify-between gap-1 w-full">
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
			<label class="label" for="edit-notes"><span class="label-text font-medium">Notes <span class="text-base-content/40">(optional)</span></span></label>
			<textarea id="edit-notes" bind:value={notes} placeholder="Playful, loves fetch..." class="textarea textarea-bordered bg-base-300/50 focus:border-primary" rows="2"></textarea>
		</div>

		<button onclick={handleSave} disabled={!dogName.trim() || saving} class="btn btn-primary w-full rounded-full" id="btn-save-edit">
			{saving ? 'Saving...' : 'Save Changes 🐾'}
		</button>
	</div>
</div>
