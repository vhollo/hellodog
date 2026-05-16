<script lang="ts">
	import '../app.css';
	import { onMount, type Snippet } from 'svelte';
	import { initAuth } from '$lib/auth';
	import { currentUser, authLoading, activeTab, userProfile } from '$lib/stores';
	import { page } from '$app/stores';

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		initAuth();
	});

	const tabs = [
		{ id: 'home' as const, label: 'Home', icon: '🏠', href: '/' },
		{ id: 'walk' as const, label: 'Walk', icon: '🐕', href: '/walk' },
		{ id: 'history' as const, label: 'History', icon: '📋', href: '/history' },
		{ id: 'predictions' as const, label: 'Predict', icon: '🔮', href: '/predictions' },
		{ id: 'settings' as const, label: 'Settings', icon: '⚙️', href: '/settings' }
	];

	// Derive active tab from current route
	$effect(() => {
		const path = $page.url.pathname;
		if (path === '/') activeTab.set('home');
		else if (path.startsWith('/walk')) activeTab.set('walk');
		else if (path.startsWith('/history')) activeTab.set('history');
		else if (path.startsWith('/predictions')) activeTab.set('predictions');
		else if (path.startsWith('/settings')) activeTab.set('settings');
	});
</script>

{#if $authLoading}
	<div class="min-h-screen flex items-center justify-center bg-base-100">
		<div class="text-center animate-fade-in">
			<div class="text-6xl animate-float mb-4">🐾</div>
			<p class="text-base-content/50 text-sm font-medium tracking-wide">Loading HelloDog...</p>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-base-100">
		{@render children()}

		<!-- Bottom Navigation (only when logged in & profile set up) -->
		{#if $currentUser && $userProfile}
			<nav class="btm-nav btm-nav-lg bg-base-200/90 backdrop-blur-xl border-t border-base-content/5" id="bottom-nav">
				{#each tabs as tab}
					<a
						href={tab.href}
						class="transition-all duration-200 {$activeTab === tab.id ? 'active text-primary' : 'text-base-content/40 hover:text-base-content/70'}"
					>
						<span class="text-xl {$activeTab === tab.id ? 'scale-110' : ''} transition-transform duration-200">{tab.icon}</span>
						<span class="btm-nav-label text-xs font-medium">{tab.label}</span>
					</a>
				{/each}
			</nav>
		{/if}
	</div>
{/if}
