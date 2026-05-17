# HelloDog AI Agent Development Guide (`AGENTS.md`)

Welcome to the HelloDog developer documentation for AI Agent integrations. This guide outlines how AI agents collaborate in this workspace, the configuration of the Model Context Protocol (MCP) servers, past engineering milestones, and guidelines for maintaining our codebase.

---

## 1. Agentic Ecosystem & MCP Configuration

To facilitate context-aware, rapid pair-programming, this workspace leverages custom Model Context Protocol (MCP) servers configured to interact with the environment, dependencies, and backend services.

### Active MCP Servers

1. **Svelte MCP Server (`@sveltejs/mcp`)**
   - **Command:** `npx -y @sveltejs/mcp`
   - **Purpose:** Supplies documentation, best practices, and runtime rules for Svelte 5, SvelteKit routing, and Svelte runes (`$state`, `$derived`, `$effect`).
   
2. **Firebase MCP Server (`firebase-tools`)**
   - **Command:** `npx -y firebase-tools@latest mcp`
   - **Purpose:** Empowers agents with direct interaction with our Firebase backend, including Firestore collection querying, security rules, and user authentications.

---

### Environment & PATH Troubleshooting (NVM / Node)

During setup in past sessions, the MCP server initialization failed due to environment issues since the agent runner launches in a non-interactive shell. Below are the key issues and their verified resolutions:

#### ❌ The Issue: `exec: "npx": executable file not found in $PATH`
When launching the MCP servers, the system could not locate `npx` or `node` because the user's interactive shell profile (e.g., `nvm` path injections) was not loaded by the MCP manager.

####  The Solution: Explicit Paths & Scoped Environment Variables
We resolved this in the local [mcp_config.json](file:///Users/vhollo/.gemini/antigravity/mcp_config.json) configuration by:
1. Using the absolute path to the Node installation directory for the commands:
   `/Users/vhollo/.nvm/versions/node/v24.14.0/bin/npx`
2. Setting an explicit `PATH` environment variable under the `env` blocks for each server:
   ```json
   "env": {
     "PATH": "/Users/vhollo/.nvm/versions/node/v24.14.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
   }
   ```
3. **Removing JSON Schema Violations:** Internal template fields like `$typeName` were removed to ensure strict compliance with standard MCP schema validators.

---

## 2. Core Collaborative Milestones

Below is a historical trace of past sessions and key features implemented by agents in this workspace:

### Phase 1 — MVP Setup (SvelteKit + Firebase PWA)
* **Stack Integration:** Scaffolded SvelteKit with TailwindCSS 4 and daisyUI 5.
* **Firebase Integration:** Connected Firebase Client Auth & Firestore database.
* **PWA Offline Mode:** Integrated `@vite-pwa/sveltekit` service workers and periodic syncing logic for offline encounter logging.

### Phase 2 — UX & Mobile Flow Optimizations
* **Sticky Bottom Navigation:** Designed a responsive navigation bar anchored with safe area insets (`pb-safe`) for iOS/Android standalone viewports.
* **Mobile Modals:** Enhanced the [EditEncounterModal.svelte](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/components/EditEncounterModal.svelte) with scroll-locking and touch-friendly targets.
* **Teleported Portal Action:** Implemented a Svelte portal node injection in [WalkTracker.svelte](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/components/WalkTracker.svelte) to escape CSS containing blocks, preventing layout clippings during map displays.

### Phase 3 — Descriptive 5-Point Attitude Rating Scale
* **Paw-Print Transition:** Replaced standard raw number rating slots with a customized descriptive 5-point scale.
* **Refactoring:** Refactored maps, lists, logs, and form inputs to use the centralized attitude mapping from [attitude.ts](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/attitude.ts):
  * **Score 1:** `Very Unfriendly` (😡, `text-error`)
  * **Score 2:** `Unfriendly` (😒, `text-warning`)
  * **Score 3:** `Neutral` (🫥, `text-base-content/70`)
  * **Score 4:** `Friendly` (🙂, `text-info`)
  * **Score 5:** `Very Friendly` (🥰, `text-success`)

### Phase 4 — Theme Customization & Color Scoping
* **DaisyUI Themes:** Switched theme configurations in [app.css](file:///Users/vhollo/Public/Google/webdev/hellodog/src/app.css) to `emerald --default` and `dim --prefersdark`.
* **Theme Isolation:** Scoped custom light-mode base colors (white background variations) inside isolated selectors to preserve beautiful dark theme aesthetics when system preferences trigger dark mode.

---

## 3. Technology Stack & Directory Guide

* **`src/routes/`**
  * `+page.svelte`: Landing onboarding screen and user dashboards.
  * `history/+page.svelte`: Lists encounters chronologically with filters.
  * `predictions/+page.svelte`: Hosts the prediction dashboard showing friendly meet chances.
* **`src/lib/`**
  * [attitude.ts](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/attitude.ts): Central score-to-attitude mapper.
  * [auth.ts](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/auth.ts): Handles Google Auth & profile store writes.
  * [firebase.ts](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/firebase.ts): Initializes Firestore databases.
  * [geo.ts](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/geo.ts): Periodic path tracking and Leaflet geolocators.
  * [stores.ts](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/stores.ts): Shared Svelte stores for `$currentUser`, `$walk`, and `$predictions`.
* **`src/lib/components/`**
  * [WalkTracker.svelte](file:///Users/vhollo/Public/Google/webdev/hellodog/src/lib/components/WalkTracker.svelte): Core interactive walk control map dashboard, overlaying Leaflet routes and predictive heatmaps (represented by size/opacity circles based on meeting history).

---

## 4. Key Architectural Patterns (For Future Agents)

When adding features or refactoring, strictly adhere to these patterns:

### Svelte 5 Runes for State Management
Avoid writing traditional Svelte 4 reactivity patterns. Use `$state`, `$derived`, and `$effect`:
```typescript
// Example of derived autocomplete names
let uniqueDogNames = $derived(
  Array.from(new Set($encounters.map(e => e.dogName))).sort()
);
```

### Firestore Document Structure
Keep schemas consistent when saving walks or logging encounters. Double-write client entries to both the local user collection and the denormalized global collection:
```typescript
// Local User subcollection
users/{uid}/encounters/{encounterId}

// Global Paid-Tier feed
encounters_global/{encounterId}
```

### Scoped styling rules in Tailwind CSS v4
Define layout styles inside [app.css](file:///Users/vhollo/Public/Google/webdev/hellodog/src/app.css) using v4 CSS-first plugins. Keep color palettes premium and modern:
* Leverage DaisyUI's CSS-based variables (e.g. `var(--color-primary)`) to keep design tokens consistent.
* Wrap theme-specific overrides to avoid leaks (e.g. scoping light-base palettes under `@plugin "daisyui/theme" { name: "cupcake"; ... }`).
