<script lang="ts">
	import { lastWalk } from '$lib/stores';
	import { formatDistance } from '$lib/geo';

	let summary = $derived($lastWalk);

	function formatDur(ms: number): string {
		const totalSec = Math.floor(ms / 1000);
		const h = Math.floor(totalSec / 3600);
		const m = Math.floor((totalSec % 3600) / 60);
		const s = totalSec % 60;
		if (h > 0) return `${h}h ${m}m`;
		if (m > 0) return `${m}m ${s}s`;
		return `${s}s`;
	}

	// A friendly headline that reflects how the walk ended.
	function headline(reason: string): string {
		switch (reason) {
			case 'home':
				return 'Welcome home! 🏠';
			case 'stationary':
				return 'Walk paused — you stopped moving 🛑';
			case 'background':
				return 'Walk wrapped up ⏸';
			default:
				return 'Nice walk! 🐾';
		}
	}

	function dismiss() {
		lastWalk.set(null);
	}
</script>

{#if summary}
	<div class="summary-card animate-slide-up">
		<button class="summary-card__close" onclick={dismiss} aria-label="Dismiss walk summary">✕</button>
		<div class="flex items-center gap-2 mb-4">
			<div class="summary-card__icon"><span class="text-lg">🎉</span></div>
			<div>
				<h2 class="text-sm font-bold">{headline(summary.reason)}</h2>
				<p class="text-[10px] text-base-content/40 font-medium">Walk complete</p>
			</div>
		</div>

		<div class="grid grid-cols-3 gap-2">
			<div class="summary-stat">
				<div class="text-lg font-bold text-primary">{formatDur(summary.durationMs)}</div>
				<div class="text-[10px] text-base-content/40">Duration</div>
			</div>
			<div class="summary-stat">
				<div class="text-lg font-bold text-secondary">{formatDistance(summary.distanceMeters)}</div>
				<div class="text-[10px] text-base-content/40">Distance</div>
			</div>
			<div class="summary-stat">
				<div class="text-lg font-bold text-accent">{summary.encounterCount}</div>
				<div class="text-[10px] text-base-content/40">Meets</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.summary-card {
		position: relative;
		background: linear-gradient(
			135deg,
			rgba(var(--color-success-rgb, 16 185 129), 0.1),
			rgba(var(--color-accent-rgb, 245 158 11), 0.05)
		);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(var(--color-success-rgb, 16 185 129), 0.18);
		border-radius: 1.25rem;
		padding: 1.25rem;
	}

	.summary-card__close {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 999px;
		font-size: 0.75rem;
		color: var(--color-base-content);
		opacity: 0.4;
		transition: opacity 0.2s;
	}

	.summary-card__close:hover {
		opacity: 1;
	}

	.summary-card__icon {
		width: 2rem;
		height: 2rem;
		border-radius: 0.625rem;
		background: rgba(var(--color-success-rgb, 16 185 129), 0.14);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.summary-stat {
		text-align: center;
		padding: 0.5rem;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.04);
	}
</style>
