<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import MultiProjectView from '$lib/components/MultiProjectView.svelte';
	import ProjectsSidebar from '$lib/components/ProjectsSidebar.svelte';

	const currentUser = $derived(ndk.$sessions.currentUser);

	onMount(() => {
		if (!currentUser) {
			goto('/login');
		}
	});

	// Subscribe to user's projects
	const projectsSubscription = ndk.$subscribe(
		() =>
			currentUser
				? {
						filters: [{ kinds: [31933], authors: [currentUser.pubkey] }],
						closeOnEose: false,
						wrap: true,
						eventClass: NDKProject
					}
				: undefined
	);

	const projects = $derived(projectsSubscription.events as NDKProject[]);

	// Update open projects when projects load
	$effect(() => {
		if (projects.length > 0) {
			openProjects.updateProjects(projects);
		}
	});
</script>

{#if currentUser}
	<div class="flex h-screen bg-gray-50 dark:bg-zinc-950">
		<!-- Sidebar -->
		<ProjectsSidebar {projects} />

		<!-- Main Content Area -->
		<div class="flex-1 flex overflow-hidden">
			{#if openProjects.projects.length > 0}
				<MultiProjectView projects={openProjects.projects} />
			{:else}
				<div class="flex-1 flex items-center justify-center">
					<div class="text-center">
						<svg
							class="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4"
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
						<h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Select projects to view</h2>
						<p class="text-gray-600 dark:text-gray-400">Click projects in the sidebar to open them in columns</p>
					</div>
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-950">
		<p class="text-gray-600 dark:text-gray-400">Redirecting to login...</p>
	</div>
{/if}
