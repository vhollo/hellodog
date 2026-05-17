<script lang="ts">
	import { updateEncounter, loadEncounters } from '$lib/encounters';
	import { currentUser, type Encounter } from '$lib/stores';
	import { getAttitudeInfo } from '$lib/attitude';

	let { encounter, onClose } = $props<{ encounter: Encounter; onClose: () => void }>();

	let dogName = $state(encounter.dogName);
	let friendliness = $state(encounter.friendliness);
	let notes = $state(encounter.notes || '');
	let saving = $state(false);

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (node.parentNode) node.parentNode.removeChild(node);
			}
		};
	}

	async function handleSave() {
		if (!dogName.trim() || !$currentUser) return;
		saving = true;
		try {
			await updateEncounter($currentUser.uid, encounter.id, {
				dogName: dogName.trim(),
				friendliness,
				notes: notes.trim()
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
