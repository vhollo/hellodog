<script lang="ts">
	import { walk, encounters, showEncounterModal, userProfile } from '$lib/stores';
	import { startWalk, stopWalk, formatDuration, type StopReason, type StartReason, onAutoStop, onAutoStart } from '$lib/geo';
	import { onMount, onDestroy } from 'svelte';

	let timer = $state('00:00');
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	let todayEncounters = $derived(
		$encounters.filter((e) => {
			const today = new Date();
			return (
				e.timestamp.getDate() === today.getDate() &&
				e.timestamp.getMonth() === today.getMonth() &&
				e.timestamp.getFullYear() === today.getFullYear()
			);
		}).length
	);

	let hasHome = $derived(!!$userProfile?.homeLocation);

	onMount(() => {
		// Register auto-start/stop callbacks for timer
		onAutoStart((reason: StartReason) => {
			startTimer();
		});

		onAutoStop((reason: StopReason) => {
			stopTimer();
		});

		// Resume timer if walk already active (e.g. page revisit)
		if ($walk.isWalking && $walk.startTime) {
			startTimer();
		}
	});

	function startTimer() {
		if (timerInterval) return;
		timerInterval = setInterval(() => {
			if ($walk.startTime) timer = formatDuration($walk.startTime);
		}, 1000);
	}

	function stopTimer() {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
		timer = '00:00';
	}

	function handleWalkToggle() {
		if ($walk.isWalking) {
			stopWalk('manual');
			stopTimer();
		} else {
			startWalk('manual');
			startTimer();
		}
	}

	function handleLogEncounter() {
		showEncounterModal.set(true);
	}

	onDestroy(() => {
		if (timerInterval) clearInterval(timerInterval);
	});
</script>

<div class="quick-actions animate-fade-in stagger-1">
	<!-- Start / Stop Walk -->
	<button
		class="action-card {$walk.isWalking ? 'action-card--active' : 'action-card--walk'}"
		onclick={handleWalkToggle}
		id="btn-quick-walk"
	>
		<div class="action-card__icon-wrap {$walk.isWalking ? 'icon-wrap--active' : ''}">
			{#if $walk.isWalking}
				<div class="pulse-ring"></div>
				<span class="action-card__icon">🏃</span>
			{:else}
				<span class="action-card__icon">🐕</span>
			{/if}
		</div>
		<div class="action-card__body">
			{#if $walk.isWalking}
				<span class="action-card__label">Walking</span>
				<span class="action-card__timer">{timer}</span>
			{:else if hasHome}
				<span class="action-card__label">Auto Walk</span>
				<span class="action-card__hint">Starts when you leave home</span>
			{:else}
				<span class="action-card__label">Start Walk</span>
				<span class="action-card__hint">Tap to begin tracking</span>
			{/if}
		</div>
		{#if $walk.isWalking}
			<div class="action-card__stop" title="Stop walk">⏹</div>
		{/if}
	</button>

	<!-- Log Encounter -->
	<button
		class="action-card action-card--log"
		onclick={handleLogEncounter}
		id="btn-quick-log"
	>
		<div class="action-card__icon-wrap icon-wrap--log">
			<span class="action-card__icon">✍️</span>
			{#if todayEncounters > 0}
				<span class="action-card__badge">{todayEncounters}</span>
			{/if}
		</div>
		<div class="action-card__body">
			<span class="action-card__label">Log Meet</span>
			<span class="action-card__hint">
				{#if todayEncounters > 0}
					{todayEncounters} today
				{:else}
					Record an encounter
				{/if}
			</span>
		</div>
	</button>
</div>

<style>
	.quick-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.action-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem 0.75rem;
		border-radius: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		backdrop-filter: blur(12px);
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		text-align: center;
		-webkit-tap-highlight-color: transparent;
	}

	.action-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.3);
	}

	.action-card:active {
		transform: translateY(0) scale(0.97);
	}

	/* Walk button (idle) */
	.action-card--walk {
		background: linear-gradient(
			135deg,
			rgba(var(--color-primary-rgb, 16 185 129), 0.1),
			rgba(var(--color-primary-rgb, 16 185 129), 0.04)
		);
		border-color: rgba(var(--color-primary-rgb, 16 185 129), 0.15);
	}

	.action-card--walk:hover {
		border-color: rgba(var(--color-primary-rgb, 16 185 129), 0.3);
		background: linear-gradient(
			135deg,
			rgba(var(--color-primary-rgb, 16 185 129), 0.15),
			rgba(var(--color-primary-rgb, 16 185 129), 0.06)
		);
	}

	/* Walk button (active/walking) */
	.action-card--active {
		background: linear-gradient(
			135deg,
			rgba(var(--color-success-rgb, 16 185 129), 0.15),
			rgba(var(--color-success-rgb, 16 185 129), 0.06)
		);
		border-color: rgba(var(--color-success-rgb, 16 185 129), 0.25);
		animation: glowPulse 3s ease-in-out infinite;
	}

	/* Log button */
	.action-card--log {
		background: linear-gradient(
			135deg,
			rgba(var(--color-secondary-rgb, 108 99 255), 0.1),
			rgba(var(--color-secondary-rgb, 108 99 255), 0.04)
		);
		border-color: rgba(var(--color-secondary-rgb, 108 99 255), 0.15);
	}

	.action-card--log:hover {
		border-color: rgba(var(--color-secondary-rgb, 108 99 255), 0.3);
		background: linear-gradient(
			135deg,
			rgba(var(--color-secondary-rgb, 108 99 255), 0.15),
			rgba(var(--color-secondary-rgb, 108 99 255), 0.06)
		);
	}

	/* Icon wrap */
	.action-card__icon-wrap {
		position: relative;
		width: 3rem;
		height: 3rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-wrap--active {
		background: rgba(var(--color-success-rgb, 16 185 129), 0.15);
	}

	.icon-wrap--log {
		background: rgba(var(--color-secondary-rgb, 108 99 255), 0.12);
	}

	.action-card__icon {
		font-size: 1.5rem;
		line-height: 1;
	}

	/* Badge for today's encounter count */
	.action-card__badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.3rem;
		border-radius: 999px;
		background: var(--color-secondary, #6c63ff);
		color: var(--color-secondary-content, #fff);
		font-size: 0.625rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		animation: badgeBounce 0.4s ease-out;
	}

	/* Body text */
	.action-card__body {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}

	.action-card__label {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--color-base-content);
	}

	.action-card__hint {
		font-size: 0.625rem;
		color: var(--color-base-content);
		opacity: 0.45;
		font-weight: 500;
	}

	.action-card__timer {
		font-family: 'Outfit', monospace;
		font-size: 1.125rem;
		font-weight: 800;
		color: var(--color-success, #10b981);
		letter-spacing: 0.02em;
	}

	.action-card__stop {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		font-size: 0.875rem;
		opacity: 0.5;
		transition: opacity 0.2s;
	}

	.action-card__stop:hover {
		opacity: 1;
	}

	/* Pulse ring behind walking icon */
	.pulse-ring {
		position: absolute;
		inset: -4px;
		border-radius: 1.125rem;
		border: 2px solid rgba(var(--color-success-rgb, 16 185 129), 0.3);
		animation: ringPulse 2s ease-out infinite;
	}

	@keyframes ringPulse {
		0% {
			transform: scale(1);
			opacity: 0.6;
		}
		100% {
			transform: scale(1.35);
			opacity: 0;
		}
	}

	@keyframes glowPulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(var(--color-success-rgb, 16 185 129), 0);
		}
		50% {
			box-shadow: 0 0 20px -4px rgba(var(--color-success-rgb, 16 185 129), 0.2);
		}
	}

	@keyframes badgeBounce {
		0% {
			transform: scale(0);
		}
		60% {
			transform: scale(1.2);
		}
		100% {
			transform: scale(1);
		}
	}
</style>
