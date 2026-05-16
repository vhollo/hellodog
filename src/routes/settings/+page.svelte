<script lang="ts">
	import { currentUser, userProfile } from '$lib/stores';
	import { signOut } from '$lib/auth';
	import { goto } from '$app/navigation';

	async function handleSignOut() {
		await signOut();
		goto('/');
	}
</script>

<svelte:head><title>HelloDog — Settings</title></svelte:head>

<div class="pb-safe min-h-screen">
	<div class="p-5 pt-8 max-w-lg mx-auto space-y-5">
		<h1 class="text-2xl font-bold animate-fade-in">Settings</h1>

		<!-- Profile Card -->
		{#if $userProfile}
			<div class="glass-card p-5 animate-fade-in stagger-1">
				<div class="flex items-center gap-4 mb-4">
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
			</div>
		{/if}

		<!-- Subscription -->
		<div class="glass-card p-5 animate-fade-in stagger-2">
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
		<div class="glass-card p-5 animate-fade-in stagger-3">
			<h2 class="font-semibold mb-2">About</h2>
			<p class="text-sm text-base-content/50">HelloDog v0.1.0</p>
			<p class="text-xs text-base-content/30 mt-1">Track walks, log dog encounters, predict friendly meets.</p>
		</div>

		<!-- Sign Out -->
		<button onclick={handleSignOut} class="btn btn-outline btn-error w-full rounded-full animate-fade-in stagger-4" id="btn-sign-out">
			Sign Out
		</button>
	</div>
</div>
