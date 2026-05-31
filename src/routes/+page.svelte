<script lang="ts">
	import { currentUser, userProfile, encounters, walk } from "$lib/stores";
	import { signInWithGoogle } from "$lib/auth";
	import { loadEncounters } from "$lib/encounters";
	import WalkTracker from "$lib/components/WalkTracker.svelte";
	import EditEncounterModal from "$lib/components/EditEncounterModal.svelte";
	import WeeklyInsights from "$lib/components/WeeklyInsights.svelte";
	import Milestones from "$lib/components/Milestones.svelte";
	import QuickActions from "$lib/components/QuickActions.svelte";
	import { getAttitudeInfo } from "$lib/attitude";
	import { initGeofenceMonitoring } from "$lib/geo";
	import type { Encounter } from "$lib/stores";
	import { onMount } from "svelte";

	let greeting = $state("");
	let recentEncounters = $derived($encounters.slice(0, 5));
	let totalEncounters = $derived($encounters.length);
	let avgFriendliness = $derived(
		$encounters.length > 0
			? (
					$encounters.reduce((s, e) => s + e.friendliness, 0) /
					$encounters.length
				).toFixed(1)
			: "—",
	);
	let uniqueDogs = $derived(
		new Set($encounters.map((e) => e.dogName.toLowerCase())).size,
	);

	let editingEncounter: Encounter | null = $state(null);

	onMount(() => {
		const h = new Date().getHours();
		greeting =
			h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

		// Initialize geofence monitoring at page level so it runs
		// regardless of whether the map component is mounted
		initGeofenceMonitoring();
	});

	$effect(() => {
		if ($currentUser && $userProfile) {
			loadEncounters($currentUser.uid);
		}
	});

	function timeAgo(date: Date): string {
		const diff = Date.now() - date.getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	async function handleOnboarding(e: SubmitEvent) {
		e.preventDefault();
		const form = e.target as HTMLFormElement;
		const fd = new FormData(form);
		const { saveUserProfile } = await import("$lib/auth");
		if ($currentUser) {
			await saveUserProfile($currentUser.uid, {
				displayName: fd.get("displayName") as string,
				dogName: fd.get("dogName") as string,
				dogBreed: fd.get("dogBreed") as string,
			});
		}
	}
</script>

<svelte:head>
	<title>HelloDog — Dashboard</title>
	<meta
		name="description"
		content="Track your dog walks and predict friendly meets."
	/>
</svelte:head>

{#if !$currentUser}
	<div
		class="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
	>
		<div class="absolute inset-0 overflow-hidden pointer-events-none">
			<div
				class="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/5 blur-3xl"
			></div>
			<div
				class="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-accent/5 blur-3xl"
			></div>
		</div>
		<div class="text-center relative z-10 max-w-md animate-fade-in">
			<div class="text-8xl mb-6 animate-float">🐕</div>
			<h1 class="text-5xl font-extrabold gradient-text mb-3">HelloDog</h1>
			<p class="text-base-content/60 text-lg mb-10 leading-relaxed">
				Track your walks, log dog encounters,<br />and predict friendly meets.
			</p>
			<button
				onclick={() => signInWithGoogle()}
				class="btn btn-lg btn-primary gap-3 rounded-full shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all duration-300 hover:scale-105 w-full max-w-xs"
				id="btn-sign-in-google"
			>
				<svg class="w-5 h-5" viewBox="0 0 24 24"
					><path
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
						fill="#4285F4"
					/><path
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						fill="#34A853"
					/><path
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						fill="#FBBC05"
					/><path
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						fill="#EA4335"
					/></svg
				>
				Sign in with Google
			</button>
			<p class="mt-6 text-base-content/30 text-sm">
				Free to use • No credit card required
			</p>
		</div>
	</div>
{:else if !$userProfile}
	<div class="min-h-screen flex flex-col items-center justify-center p-6">
		<div class="w-full max-w-md animate-fade-in">
			<div class="text-center mb-8">
				<div class="text-6xl mb-4">🐾</div>
				<h1 class="text-3xl font-bold mb-2">Welcome to HelloDog!</h1>
				<p class="text-base-content/60">Tell us about you and your pup</p>
			</div>
			<form onsubmit={handleOnboarding} class="glass-card p-6 space-y-5">
				<div class="form-control">
					<label class="label" for="displayName"
						><span class="label-text font-medium">Your name</span></label
					>
					<input
						type="text"
						name="displayName"
						id="displayName"
						placeholder="e.g. Sarah"
						class="input input-bordered w-full bg-base-200/50 focus:border-primary"
						required
						value={$currentUser?.displayName || ""}
					/>
				</div>
				<div class="form-control">
					<label class="label" for="dogName"
						><span class="label-text font-medium">Your dog's name 🐕</span
						></label
					>
					<input
						type="text"
						name="dogName"
						id="dogName"
						placeholder="e.g. Buddy"
						class="input input-bordered w-full bg-base-200/50 focus:border-primary"
						required
					/>
				</div>
				<div class="form-control">
					<label class="label" for="dogBreed"
						><span class="label-text font-medium"
							>Breed <span class="text-base-content/40">(optional)</span></span
						></label
					>
					<input
						type="text"
						name="dogBreed"
						id="dogBreed"
						placeholder="e.g. Golden Retriever"
						class="input input-bordered w-full bg-base-200/50 focus:border-primary"
					/>
				</div>
				<button
					type="submit"
					class="btn btn-primary w-full rounded-full mt-2"
					id="btn-save-profile">Let's Go! 🐾</button
				>
			</form>
		</div>
	</div>
{:else}
	<div class="pb-safe">
		<div class="p-5 pt-8 max-w-lg mx-auto space-y-6">
			<!-- ① Greeting + Stats -->
			<div class="animate-fade-in">
				<p class="text-base-content/50 text-sm font-medium">{greeting}</p>
				<h1 class="text-2xl font-bold mt-1">
					{$userProfile.displayName} &
					<span class="gradient-text">{$userProfile.dogName}</span>
				</h1>
			</div>

			<div class="grid grid-cols-3 gap-3 animate-fade-in stagger-1">
				<div class="glass-card p-4 text-center">
					<div class="text-2xl font-bold text-primary">{totalEncounters}</div>
					<div class="text-xs text-base-content/50 mt-1">Meets</div>
				</div>
				<div class="glass-card p-4 text-center">
					<div class="text-2xl font-bold text-secondary">{uniqueDogs}</div>
					<div class="text-xs text-base-content/50 mt-1">Dogs</div>
				</div>
				<div class="glass-card p-4 text-center">
					<div class="text-2xl font-bold text-accent">{avgFriendliness}</div>
					<div class="text-xs text-base-content/50 mt-1">Avg 🐾</div>
				</div>
			</div>

			<!-- ② Quick Actions (primary CTAs) -->
			<QuickActions />

			<!-- ③ Walk Tracker (map — only when walking) -->
			{#if $walk.isWalking}
				<div class="animate-fade-in">
					<WalkTracker />
				</div>
			{/if}

			<!-- ④ Recent Encounters -->
			{#if recentEncounters.length > 0}
				<div class="animate-fade-in stagger-2">
					<div class="flex items-center justify-between mb-3">
						<h2 class="text-lg font-semibold">Recent Encounters</h2>
						<a href="/history" class="text-primary text-sm hover:underline"
							>See all →</a
						>
					</div>
					<div class="space-y-2">
						{#each recentEncounters as enc, i}
							<button
								class="w-full text-left glass-card p-4 flex items-center gap-3 hover:bg-base-content/5 transition-colors"
								style="animation-delay: {i * 0.1}s"
								onclick={() => (editingEncounter = enc)}
							>
								<div
									class="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-lg shrink-0"
								>
									🐕
								</div>
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{enc.dogName}</div>
									<div class="text-xs text-base-content/40">
										{timeAgo(enc.timestamp)}
									</div>
								</div>
								<div
									class="text-xl shrink-0"
									title={getAttitudeInfo(enc.friendliness).text}
								>
									{getAttitudeInfo(enc.friendliness).emoji}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<div class="glass-card p-8 text-center animate-fade-in stagger-2">
					<div class="text-5xl mb-3 animate-float">🐾</div>
					<h3 class="font-semibold mb-1">No encounters yet</h3>
					<p class="text-base-content/50 text-sm mb-4">
						Start a walk and log your first dog encounter!
					</p>
				</div>
			{/if}

			<!-- ⑤ Weekly Insights -->
			<WeeklyInsights />

			<!-- ⑥ Milestones -->
			<Milestones />

			<!-- ⑦ Plan Badge -->
			<div
				class="glass-card p-4 flex items-center gap-3 animate-fade-in stagger-3"
			>
				<div class="text-2xl">{$userProfile.isPaid ? "👑" : "🆓"}</div>
				<div class="flex-1">
					<div class="font-medium text-sm">
						{$userProfile.isPaid ? "Premium" : "Free"} Plan
					</div>
					<div class="text-xs text-base-content/40">
						{$userProfile.isPaid
							? "Predictions from all met users"
							: "Predictions from your logs only"}
					</div>
				</div>
				{#if !$userProfile.isPaid}<a
						href="/settings"
						class="btn btn-xs btn-accent rounded-full">Upgrade</a
					>{/if}
			</div>
		</div>
	</div>

	{#if editingEncounter}
		<EditEncounterModal
			encounter={editingEncounter}
			onClose={() => (editingEncounter = null)}
		/>
	{/if}
{/if}



