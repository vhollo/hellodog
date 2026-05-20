<script lang="ts">
	import "../app.css";
	import { onMount, type Snippet } from "svelte";
	import { initAuth } from "$lib/auth";
	import {
		currentUser,
		authLoading,
		activeTab,
		userProfile,
		showEncounterModal,
	} from "$lib/stores";
	import { page } from "$app/stores";

	let { children }: { children: Snippet } = $props();

	onMount(() => {
		initAuth();

		// PWA Automatic Update on Launch
		if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
			// Listen for the controlling service worker changing (e.g. new SW taking over)
			navigator.serviceWorker.addEventListener("controllerchange", () => {
				console.log(
					"[PWA] New service worker activated, reloading to apply updates...",
				);
				window.location.reload();
			});

			// Check for updates on launch
			navigator.serviceWorker.ready.then((registration) => {
				console.log("[PWA] Service worker is ready. Checking for updates...");

				// 1. If there's a waiting service worker already, force it to activate
				if (registration.waiting) {
					console.log("[PWA] Found a waiting service worker. Activating...");
					registration.waiting.postMessage({ type: "SKIP_WAITING" });
				}

				// 2. Listen for new service workers installing
				registration.addEventListener("updatefound", () => {
					const newWorker = registration.installing;
					if (newWorker) {
						newWorker.addEventListener("statechange", () => {
							if (newWorker.state === "installed") {
								console.log(
									"[PWA] New service worker installed. Skipping waiting...",
								);
								newWorker.postMessage({ type: "SKIP_WAITING" });
							}
						});
					}
				});

				// 3. Trigger manual update check
				registration.update().catch((err) => {
					console.error("[PWA] Service worker update check failed:", err);
				});
			});
		}
	});

	const tabs = [
		{ id: "home" as const, label: "Home", icon: "🏠", href: "/" },
		{ id: "history" as const, label: "History", icon: "📋", href: "/history" },
		{
			id: "predictions" as const,
			label: "Predict",
			icon: "🔮",
			href: "/predictions",
		},
		{
			id: "settings" as const,
			label: "Settings",
			icon: "⚙️",
			href: "/settings",
		},
	];

	// Derive active tab from current route
	$effect(() => {
		const path = $page.url.pathname;
		if (path === "/") activeTab.set("home");
		else if (path.startsWith("/history")) activeTab.set("history");
		else if (path.startsWith("/predictions")) activeTab.set("predictions");
		else if (path.startsWith("/settings")) activeTab.set("settings");
	});
</script>

{#if $authLoading}
	<div class="min-h-screen flex items-center justify-center bg-base-100">
		<div class="text-center animate-fade-in">
			<div class="text-6xl animate-float mb-4">🐾</div>
			<p class="text-base-content/50 text-sm font-medium tracking-wide">
				Loading HelloDog...
			</p>
		</div>
	</div>
{:else}
	<div class="min-h-screen bg-base-100">
		{@render children()}

		<!-- Quick-Log FAB (visible on non-home pages) -->
		{#if $currentUser && $userProfile && $activeTab !== 'home'}
			<button
				onclick={() => showEncounterModal.set(true)}
				class="fab-log-btn"
				id="fab-quick-log"
				title="Quick log an encounter"
			>
				<span class="text-xl">✍️</span>
			</button>
		{/if}

		<!-- Bottom Navigation (only when logged in & profile set up) -->
		{#if $currentUser && $userProfile}
			<nav
				class="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center pb-[env(safe-area-inset-bottom)] bg-base-200/90 backdrop-blur-xl border-t border-base-content/5 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.5)]"
				id="bottom-nav"
			>
				{#each tabs as tab}
					<a
						href={tab.href}
						class="flex flex-col items-center justify-center flex-1 h-16 transition-all duration-300 {$activeTab ===
						tab.id
							? 'text-primary'
							: 'text-base-content/40 hover:text-base-content/80'}"
					>
						<span
							class="text-2xl {$activeTab === tab.id
								? 'scale-110 -translate-y-0.5'
								: ''} transition-all duration-300">{tab.icon}</span
						>
						<span
							class="text-[10px] font-bold uppercase tracking-wider {$activeTab ===
							tab.id
								? 'opacity-100'
								: 'opacity-50'} transition-all duration-300"
						>
							{tab.label}
						</span>
					</a>
				{/each}
			</nav>
		{/if}
	</div>
{/if}
