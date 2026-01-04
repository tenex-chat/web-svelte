<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { loginModal } from '$lib/stores/loginModal.svelte';
	import { viewModeStore } from '$lib/stores/viewMode.svelte';
	import MultiProjectView from '$lib/components/MultiProjectView.svelte';
	import GlobalStatusView from '$lib/components/GlobalStatusView.svelte';
	import ProjectsSidebar from '$lib/components/ProjectsSidebar.svelte';

	// Subscribe to user's projects
	const projectsSubscription = ndk.$subscribe(
		() =>
			ndk.$currentPubkey
				? {
						filters: [{ kinds: [31933], authors: [ndk.$currentPubkey] }],
						closeOnEose: false,
						wrap: true,
					}
				: undefined
	);

	const projects = $derived.by(() => projectsSubscription.events.map(NDKProject.from));

	// View mode
	const viewMode = $derived(viewModeStore.value);

	// Update open projects when projects load
	$effect(() => {
		if (projects.length > 0) {
			openProjects.updateProjects(projects);
		}
	});
</script>

{#if ndk.$currentPubkey}
	<div class="flex h-screen bg-background">
		<!-- Sidebar -->
		<ProjectsSidebar {projects} />

		<!-- Main Content Area -->
		<div class="flex-1 flex overflow-hidden">
			{#if viewMode === 'status'}
				<!-- Global Status Dashboard View -->
				{#if openProjects.projects.length > 0}
					<GlobalStatusView />
				{:else}
					<div class="flex-1 flex items-center justify-center">
						<div class="text-center">
							<svg
								class="w-16 h-16 text-muted-foreground mx-auto mb-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
								/>
							</svg>
							<h2 class="text-xl font-semibold text-foreground mb-2">No projects open</h2>
							<p class="text-muted-foreground">Open projects in the sidebar to see their status</p>
						</div>
					</div>
				{/if}
			{:else}
				<!-- Multi-Project Column View -->
				{#if openProjects.filteredProjects.length > 0}
					<MultiProjectView projects={openProjects.filteredProjects} />
				{:else}
					<div class="flex-1 flex items-center justify-center">
						<div class="text-center">
							<svg
								class="w-16 h-16 text-muted-foreground mx-auto mb-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
								/>
							</svg>
							<h2 class="text-xl font-semibold text-foreground mb-2">Select projects to view</h2>
							<p class="text-muted-foreground">Click projects in the sidebar to open them in columns</p>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-950 p-4">
		<div class="text-center max-w-md">
			<h1 class="text-6xl font-bold text-foreground mb-4">TENEX</h1>
			<p class="text-xl text-muted-foreground mb-8">Orchestrate AI Agents on Nostr</p>
			<button
				onclick={() => loginModal.open()}
				class="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors"
			>
				Get Started
			</button>
		</div>
	</div>
{/if}
