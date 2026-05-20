<script lang="ts">
	import { encounters } from '$lib/stores';
	import { computeWeeklyInsights, type WeeklyInsight } from '$lib/insights';
	import { getAttitudeInfo } from '$lib/attitude';

	let insights = $derived(computeWeeklyInsights($encounters));

	let trendArrow = $derived(
		insights.friendlinessChange > 0 ? '↑' : insights.friendlinessChange < 0 ? '↓' : '→'
	);
	let trendClass = $derived(
		insights.friendlinessChange > 0
			? 'text-success'
			: insights.friendlinessChange < 0
				? 'text-error'
				: 'text-base-content/50'
	);
</script>

{#if $encounters.length >= 3}
	<div class="insights-card animate-fade-in stagger-1">
		<!-- Sparkle header -->
		<div class="flex items-center gap-2 mb-4">
			<div class="insights-icon">
				<span class="text-lg">💡</span>
			</div>
			<div>
				<h2 class="text-sm font-bold uppercase tracking-wider text-primary">
					Your Week
				</h2>
				<p class="text-[10px] text-base-content/40 font-medium">
					{insights.activeDaysThisWeek} active day{insights.activeDaysThisWeek !== 1 ? 's' : ''} this week
				</p>
			</div>
		</div>

		<!-- Headline insight -->
		<div class="mb-5">
			<p class="text-base font-semibold leading-snug">
				{insights.headline}
			</p>
		</div>

		<!-- Mini stats row -->
		{#if insights.totalMeetsThisWeek > 0}
			<div class="grid grid-cols-3 gap-2 mb-4">
				<div class="insight-stat">
					<div class="text-lg font-bold text-primary">{insights.totalMeetsThisWeek}</div>
					<div class="text-[10px] text-base-content/40">This week</div>
				</div>
				<div class="insight-stat">
					<div class="text-lg font-bold text-secondary">{insights.newDogsThisWeek}</div>
					<div class="text-[10px] text-base-content/40">New dogs</div>
				</div>
				<div class="insight-stat">
					<div class="text-lg font-bold {trendClass}">
						{insights.avgFriendlinessThisWeek}
						<span class="text-xs">{trendArrow}</span>
					</div>
					<div class="text-[10px] text-base-content/40">Friendliness</div>
				</div>
			</div>
		{/if}

		<!-- Friendly vibes bar -->
		{#if insights.totalMeetsThisWeek > 0}
			<div class="mb-4">
				<div class="flex items-center justify-between mb-1.5">
					<span class="text-xs font-medium text-base-content/60">Friendly vibes</span>
					<span class="text-xs font-bold {insights.friendlyPercentThisWeek >= 70 ? 'text-success' : insights.friendlyPercentThisWeek >= 40 ? 'text-warning' : 'text-error'}">
						{insights.friendlyPercentThisWeek}%
					</span>
				</div>
				<div class="h-2 rounded-full bg-base-300/50 overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-1000 ease-out {insights.friendlyPercentThisWeek >= 70 ? 'friendly-bar-success' : insights.friendlyPercentThisWeek >= 40 ? 'friendly-bar-warning' : 'friendly-bar-error'}"
						style="width: {insights.friendlyPercentThisWeek}%"
					></div>
				</div>
			</div>
		{/if}

		<!-- Returning dogs highlight -->
		{#if insights.returningDogsThisWeek.length > 0}
			<div class="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl bg-primary/8 border border-primary/10">
				<span class="text-base">🔄</span>
				<p class="text-xs text-base-content/70">
					<span class="font-semibold">{insights.returningDogsThisWeek.join(', ')}</span>
					{insights.returningDogsThisWeek.length === 1 ? 'is' : 'are'} becoming familiar!
				</p>
			</div>
		{/if}

		<!-- Top dog -->
		{#if insights.topDog && insights.topDog.meets >= 2}
			<div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/8 border border-accent/10 mb-4">
				<span class="text-base">⭐</span>
				<p class="text-xs text-base-content/70">
					<span class="font-semibold">{insights.topDog.name}</span> — met {insights.topDog.meets} times total
				</p>
			</div>
		{/if}

		<!-- Encouragement -->
		<p class="text-xs text-base-content/45 leading-relaxed italic">
			"{insights.encouragement}"
		</p>
	</div>
{/if}

<style>
	.insights-card {
		background: linear-gradient(135deg, rgba(var(--color-primary-rgb, 16 185 129), 0.06), rgba(var(--color-accent-rgb, 245 158 11), 0.04));
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 1.25rem;
		padding: 1.25rem;
		position: relative;
		overflow: hidden;
	}

	.insights-card::before {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		width: 120px;
		height: 120px;
		background: radial-gradient(circle, rgba(var(--color-primary-rgb, 16 185 129), 0.08) 0%, transparent 70%);
		pointer-events: none;
	}

	.insights-icon {
		width: 2rem;
		height: 2rem;
		border-radius: 0.625rem;
		background: rgba(var(--color-primary-rgb, 16 185 129), 0.12);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.insight-stat {
		text-align: center;
		padding: 0.5rem;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.04);
	}

	.friendly-bar-success {
		background: linear-gradient(90deg, var(--color-success, #10b981), var(--color-primary, #059669));
	}
	.friendly-bar-warning {
		background: linear-gradient(90deg, var(--color-warning, #f59e0b), var(--color-accent, #d97706));
	}
	.friendly-bar-error {
		background: linear-gradient(90deg, var(--color-error, #ef4444), var(--color-warning, #f59e0b));
	}
</style>
