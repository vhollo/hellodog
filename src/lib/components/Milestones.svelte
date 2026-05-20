<script lang="ts">
	import { encounters } from '$lib/stores';
	import { computeMilestones, type Milestone } from '$lib/insights';

	let milestones = $derived(computeMilestones($encounters));
	let unlocked = $derived(milestones.filter(m => m.unlocked));
	let inProgress = $derived(milestones.filter(m => !m.unlocked));
	let nextUp = $derived(inProgress.length > 0
		? inProgress.reduce((best, m) => m.progress > best.progress ? m : best, inProgress[0])
		: null
	);
	let expanded = $state(false);
</script>

{#if $encounters.length >= 1}
	<div class="glass-card p-5 animate-fade-in stagger-2">
		<!-- Header with unlock count -->
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2">
				<div class="w-8 h-8 rounded-[0.625rem] bg-accent/12 flex items-center justify-center">
					<span class="text-lg">🏅</span>
				</div>
				<div>
					<h2 class="text-sm font-bold uppercase tracking-wider text-accent">Milestones</h2>
					<p class="text-[10px] text-base-content/40 font-medium">
						{unlocked.length} of {milestones.length} unlocked
					</p>
				</div>
			</div>
			<button
				onclick={() => expanded = !expanded}
				class="btn btn-ghost btn-xs btn-circle text-base-content/40"
				id="btn-toggle-milestones"
			>
				<span class="text-sm transition-transform duration-300" class:rotate-180={expanded}>▾</span>
			</button>
		</div>

		<!-- Overall progress bar -->
		<div class="mb-4">
			<div class="h-2 rounded-full bg-base-300/50 overflow-hidden">
				<div
					class="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-1000 ease-out"
					style="width: {Math.round((unlocked.length / milestones.length) * 100)}%"
				></div>
			</div>
		</div>

		<!-- Next milestone to unlock (always visible) -->
		{#if nextUp}
			<div class="next-milestone-card mb-3">
				<div class="flex items-center gap-3">
					<div class="text-2xl grayscale opacity-60 milestone-icon-pulse">{nextUp.icon}</div>
					<div class="flex-1 min-w-0">
						<div class="text-xs font-bold text-base-content/80">Next: {nextUp.title}</div>
						<div class="text-[10px] text-base-content/40">{nextUp.description}</div>
						<div class="mt-1.5 flex items-center gap-2">
							<div class="flex-1 h-1.5 rounded-full bg-base-300/50 overflow-hidden">
								<div
									class="h-full rounded-full bg-gradient-to-r from-warning to-accent transition-all duration-700"
									style="width: {nextUp.progress * 100}%"
								></div>
							</div>
							<span class="text-[10px] font-mono font-bold text-base-content/50">
								{nextUp.current}/{nextUp.target}
							</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Unlocked badges row (compact, always visible) -->
		{#if unlocked.length > 0}
			<div class="flex flex-wrap gap-1.5 mb-1">
				{#each unlocked as m, i}
					<div
						class="unlocked-badge"
						title="{m.title}: {m.description}"
						style="animation-delay: {i * 0.08}s"
					>
						<span class="text-lg">{m.icon}</span>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Expanded view: all milestones with detail -->
		{#if expanded}
			<div class="mt-4 space-y-2.5 animate-slide-up">
				{#each milestones as m, i}
					<div
						class="flex items-center gap-3 p-2.5 rounded-xl transition-all {m.unlocked ? 'bg-success/5' : 'bg-base-300/20 opacity-60'}"
						style="animation-delay: {i * 0.05}s"
					>
						<div class="text-xl {m.unlocked ? '' : 'grayscale opacity-40'}">
							{m.icon}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-1.5">
								<span class="text-xs font-semibold {m.unlocked ? 'text-base-content' : 'text-base-content/50'}">
									{m.title}
								</span>
								{#if m.unlocked}
									<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-bold">✓</span>
								{/if}
							</div>
							<div class="text-[10px] text-base-content/40">{m.description}</div>
							{#if !m.unlocked}
								<div class="mt-1 flex items-center gap-2">
									<div class="flex-1 h-1 rounded-full bg-base-300/50 overflow-hidden">
										<div
											class="h-full rounded-full bg-base-content/20 transition-all duration-500"
											style="width: {m.progress * 100}%"
										></div>
									</div>
									<span class="text-[9px] font-mono text-base-content/30">{m.current}/{m.target}</span>
								</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.next-milestone-card {
		background: linear-gradient(135deg, rgba(var(--color-warning-rgb, 245 158 11), 0.06), rgba(var(--color-accent-rgb, 245 158 11), 0.03));
		border: 1px solid rgba(var(--color-warning-rgb, 245 158 11), 0.1);
		border-radius: 0.875rem;
		padding: 0.75rem;
	}

	.unlocked-badge {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.625rem;
		background: rgba(var(--color-success-rgb, 16 185 129), 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: badgePop 0.4s ease-out forwards;
		opacity: 0;
		transform: scale(0.8);
	}

	@keyframes badgePop {
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.milestone-icon-pulse {
		animation: pulse-gentle 2.5s ease-in-out infinite;
	}

	@keyframes pulse-gentle {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	.rotate-180 {
		transform: rotate(180deg);
	}
</style>
