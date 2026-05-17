<script lang="ts">
	import { encounters, predictions, currentUser, userProfile } from '$lib/stores';
	import { generatePredictions, loadGlobalEncountersForUser, loadEncounters } from '$lib/encounters';
	import { getAttitudeInfo } from '$lib/attitude';
	import { onMount } from 'svelte';

	let loading = $state(false);
	let sorted = $derived([...$predictions].sort((a, b) => b.likelihood - a.likelihood));

	onMount(async () => {
		if ($currentUser) {
			await loadEncounters($currentUser.uid);
		}
	});

	async function runPredictions() {
		if (!$currentUser) return;
		loading = true;
		try {
			let globalEncs: any[] = [];
			if ($userProfile?.isPaid) {
				globalEncs = await loadGlobalEncountersForUser($currentUser.uid);
			}
			generatePredictions($encounters, globalEncs);
		} finally {
			loading = false;
		}
	}

	function getLikelihoodColor(l: number): string {
		if (l >= 70) return 'text-success';
		if (l >= 40) return 'text-warning';
		return 'text-error';
	}

	function getLikelihoodBg(l: number): string {
		if (l >= 70) return 'bg-success/15';
		if (l >= 40) return 'bg-warning/15';
		return 'bg-error/15';
	}
</script>

<svelte:head><title>HelloDog — Predictions</title></svelte:head>

<div class="pb-safe min-h-screen">
	<div class="p-5 pt-8 max-w-lg mx-auto space-y-5">
		<div class="animate-fade-in">
			<h1 class="text-2xl font-bold">Predictions 🔮</h1>
			<p class="text-base-content/50 text-sm mt-1">
				{$userProfile?.isPaid
					? 'Based on your logs + all met users\' data'
					: 'Based on your encounter history'}
			</p>
		</div>

		<button onclick={runPredictions} disabled={loading || $encounters.length === 0} class="btn btn-primary w-full rounded-full gap-2 animate-fade-in stagger-1" id="btn-run-predictions">
			{#if loading}
				<span class="loading loading-spinner loading-sm"></span> Analyzing...
			{:else}
				🔮 Generate Predictions
			{/if}
		</button>

		{#if !$userProfile?.isPaid}
			<div class="glass-card p-4 flex items-start gap-3 border-accent/20 animate-fade-in stagger-2">
				<div class="text-xl mt-0.5">👑</div>
				<div>
					<div class="font-medium text-sm">Upgrade to Premium</div>
					<div class="text-xs text-base-content/40 mt-0.5">Get predictions based on data from all users you've ever met — more dogs, better accuracy!</div>
					<a href="/settings" class="btn btn-xs btn-accent rounded-full mt-2">Learn More</a>
				</div>
			</div>
		{/if}

		{#if sorted.length > 0}
			<div class="space-y-3 animate-fade-in stagger-3">
				{#each sorted as pred, i}
					<div class="glass-card p-4 space-y-3 hover:bg-base-content/5 transition-colors" style="animation-delay: {i * 0.08}s">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded-full {getLikelihoodBg(pred.likelihood)} flex items-center justify-center">
								<span class="text-lg font-bold {getLikelihoodColor(pred.likelihood)}">{pred.likelihood}%</span>
							</div>
							<div class="flex-1">
								<div class="font-semibold">{pred.dogName}</div>
								<div class="text-xs text-base-content/40">{pred.totalMeets} meet{pred.totalMeets !== 1 ? 's' : ''} logged</div>
							</div>
							<div class="text-xl" title={getAttitudeInfo(pred.avgFriendliness).text}>{getAttitudeInfo(pred.avgFriendliness).emoji}</div>
						</div>

						<div class="grid grid-cols-2 gap-2 text-xs">
							<div class="bg-base-300/30 rounded-lg p-2">
								<div class="text-base-content/40">Best Time</div>
								<div class="font-medium mt-0.5">🕐 {pred.bestTime}</div>
							</div>
							<div class="bg-base-300/30 rounded-lg p-2">
								<div class="text-base-content/40">Attitude</div>
								<div class="font-medium mt-0.5">{getAttitudeInfo(pred.avgFriendliness).emoji} {getAttitudeInfo(pred.avgFriendliness).text}</div>
							</div>
						</div>

						{#if pred.basedOnUsers}
							<div class="text-xs text-accent flex items-center gap-1">
								<span>👑</span> Based on {pred.basedOnUsers} user{pred.basedOnUsers !== 1 ? 's' : ''} data
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else if $encounters.length === 0}
			<div class="glass-card p-8 text-center animate-fade-in stagger-3">
				<div class="text-5xl mb-3">📊</div>
				<h3 class="font-semibold mb-1">No data yet</h3>
				<p class="text-base-content/50 text-sm">Log some encounters first to get predictions!</p>
			</div>
		{:else if !loading}
			<div class="glass-card p-8 text-center animate-fade-in stagger-3">
				<div class="text-5xl mb-3 animate-float">🔮</div>
				<h3 class="font-semibold mb-1">Ready to predict</h3>
				<p class="text-base-content/50 text-sm">Tap the button above to analyze your {$encounters.length} encounter{$encounters.length !== 1 ? 's' : ''}!</p>
			</div>
		{/if}
	</div>
</div>
