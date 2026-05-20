<script lang="ts">
	import { currentUser, userProfile } from '$lib/stores';
	import { signOut, updateUserProfile } from '$lib/auth';
	import { getCurrentPosition } from '$lib/geo';
	import { goto } from '$app/navigation';

	let isEditingProfile = $state(false);
	let editDisplayName = $state('');
	let editDogName = $state('');
	let editDogBreed = $state('');
	let isSaving = $state(false);

	function startEdit() {
		if ($userProfile) {
			editDisplayName = $userProfile.displayName;
			editDogName = $userProfile.dogName;
			editDogBreed = $userProfile.dogBreed || '';
			isEditingProfile = true;
		}
	}

	async function saveProfile() {
		if (!$currentUser || !$userProfile) return;
		isSaving = true;
		try {
			await updateUserProfile($currentUser.uid, {
				displayName: editDisplayName,
				dogName: editDogName,
				dogBreed: editDogBreed
			});
			isEditingProfile = false;
		} finally {
			isSaving = false;
		}
	}

	async function handleSignOut() {
		await signOut();
		goto('/');
	}

	// Home Location
	let settingHome = $state(false);
	let homeError = $state('');

	async function setHomeToCurrentLocation() {
		if (!$currentUser) return;
		settingHome = true;
		homeError = '';
		try {
			const pos = await getCurrentPosition();
			const homeLocation = {
				lat: pos.coords.latitude,
				lng: pos.coords.longitude
			};
			await updateUserProfile($currentUser.uid, { homeLocation } as any);
		} catch (err: any) {
			homeError = err?.message || 'Could not get your location';
		} finally {
			settingHome = false;
		}
	}

	async function clearHomeLocation() {
		if (!$currentUser) return;
		await updateUserProfile($currentUser.uid, { homeLocation: null } as any);
	}
</script>

<svelte:head><title>HelloDog — Settings</title></svelte:head>

<div class="pb-safe min-h-screen">
	<div class="p-5 pt-8 max-w-lg mx-auto space-y-5">
		<h1 class="text-2xl font-bold animate-fade-in">Settings</h1>

		<!-- Profile Card -->
		{#if $userProfile}
			<div class="glass-card p-5 animate-fade-in stagger-1 relative">
				{#if !isEditingProfile}
					<button class="absolute top-4 right-4 text-sm text-primary hover:underline font-medium" onclick={startEdit}>Edit</button>
					<div class="flex items-center gap-4 mb-4 pr-10">
						<div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-2xl">
							{$currentUser?.photoURL
								? ''
								: '🧑'}
						</div>
						{#if $currentUser?.photoURL}
							<img src={$currentUser.photoURL} alt="Profile" class="w-14 h-14 rounded-full absolute" />
						{/if}
						<div>
							<div class="font-semibold text-lg">{$userProfile.displayName}</div>
							<div class="text-sm text-base-content/50">{$currentUser?.email || 'Anonymous'}</div>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-3 text-sm">
						<div class="bg-base-300/30 rounded-lg p-3">
							<div class="text-xs text-base-content/40">Dog</div>
							<div class="font-medium">🐕 {$userProfile.dogName}</div>
						</div>
						<div class="bg-base-300/30 rounded-lg p-3">
							<div class="text-xs text-base-content/40">Breed</div>
							<div class="font-medium">{$userProfile.dogBreed || '—'}</div>
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						<h2 class="font-semibold text-lg">Edit Profile</h2>
						<div class="form-control">
							<label class="label text-xs font-medium text-base-content/70 pb-1" for="editDisplayName">Your Name</label>
							<input id="editDisplayName" type="text" class="input input-sm input-bordered w-full bg-base-200/50 focus:border-primary" bind:value={editDisplayName} />
						</div>
						<div class="form-control">
							<label class="label text-xs font-medium text-base-content/70 pb-1" for="editDogName">Dog's Name</label>
							<input id="editDogName" type="text" class="input input-sm input-bordered w-full bg-base-200/50 focus:border-primary" bind:value={editDogName} />
						</div>
						<div class="form-control">
							<label class="label text-xs font-medium text-base-content/70 pb-1" for="editDogBreed">Dog's Breed</label>
							<input id="editDogBreed" type="text" class="input input-sm input-bordered w-full bg-base-200/50 focus:border-primary" bind:value={editDogBreed} />
						</div>
						<div class="flex gap-2 pt-2">
							<button class="btn btn-sm flex-1 rounded-full" onclick={() => isEditingProfile = false} disabled={isSaving}>Cancel</button>
							<button class="btn btn-sm btn-primary flex-1 rounded-full" onclick={saveProfile} disabled={isSaving}>
								{isSaving ? 'Saving...' : 'Save'}
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Home Location -->
		<div class="glass-card p-5 animate-fade-in stagger-2">
			<div class="flex items-center gap-2 mb-3">
				<span class="text-xl">🏠</span>
				<h2 class="font-semibold">Home Location</h2>
			</div>
			<p class="text-xs text-base-content/50 mb-4">
				Set your home so walks start and stop automatically when you leave and return.
			</p>

			{#if $userProfile?.homeLocation}
				<div class="flex items-center gap-3 bg-success/8 rounded-xl p-3 mb-3">
					<div class="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center text-lg">✅</div>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium">Home is set</div>
						<div class="text-[10px] text-base-content/40 font-mono">
							{$userProfile.homeLocation.lat.toFixed(4)}, {$userProfile.homeLocation.lng.toFixed(4)}
						</div>
					</div>
				</div>
				<div class="flex gap-2">
					<button
						onclick={setHomeToCurrentLocation}
						class="btn btn-sm flex-1 rounded-full gap-1"
						disabled={settingHome}
						id="btn-update-home"
					>
						{settingHome ? '📡 Locating...' : '📍 Update'}
					</button>
					<button
						onclick={clearHomeLocation}
						class="btn btn-sm btn-ghost rounded-full text-error"
						id="btn-clear-home"
					>
						Remove
					</button>
				</div>
			{:else}
				<button
					onclick={setHomeToCurrentLocation}
					class="btn btn-primary w-full rounded-full gap-2"
					disabled={settingHome}
					id="btn-set-home"
				>
					{#if settingHome}
						<span class="loading loading-spinner loading-sm"></span> Locating...
					{:else}
						📍 Use Current Location as Home
					{/if}
				</button>
			{/if}

			{#if homeError}
				<div class="text-xs text-error mt-2">{homeError}</div>
			{/if}
		</div>

		<!-- Subscription -->
		<div class="glass-card p-5 animate-fade-in stagger-3">
			<h2 class="font-semibold mb-3">Subscription</h2>
			<div class="flex items-center gap-3 mb-4">
				<div class="text-3xl">{$userProfile?.isPaid ? '👑' : '🆓'}</div>
				<div>
					<div class="font-medium">{$userProfile?.isPaid ? 'Premium' : 'Free'} Plan</div>
					<div class="text-xs text-base-content/40">
						{$userProfile?.isPaid
							? 'Predictions from all met users\' data'
							: 'Predictions from your own logs only'}
					</div>
				</div>
			</div>
			{#if !$userProfile?.isPaid}
				<div class="bg-gradient-to-r from-accent/10 to-primary/10 rounded-xl p-4 space-y-3">
					<h3 class="font-semibold text-sm">Upgrade to Premium 👑</h3>
					<ul class="text-xs text-base-content/60 space-y-1.5">
						<li>✅ Cross-user predictions from all dogs you've met</li>
						<li>✅ Broader location & time insights</li>
						<li>✅ "Dogs nearby now" feature (coming soon)</li>
						<li>✅ Priority support</li>
					</ul>
					<button class="btn btn-accent btn-sm w-full rounded-full" id="btn-upgrade">
						Coming Soon — $2.99/mo
					</button>
				</div>
			{/if}
		</div>

		<!-- About -->
		<div class="glass-card p-5 animate-fade-in stagger-4">
			<h2 class="font-semibold mb-2">About</h2>
			<p class="text-sm text-base-content/50">HelloDog v0.1.0</p>
			<p class="text-xs text-base-content/30 mt-1">Track walks, log dog encounters, predict friendly meets.</p>
		</div>

		<!-- Sign Out -->
		<button onclick={handleSignOut} class="btn btn-outline btn-error w-full rounded-full animate-fade-in stagger-5" id="btn-sign-out">
			Sign Out
		</button>
	</div>
</div>
