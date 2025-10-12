<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		projects: NDKProject[];
	}

	let { projects }: Props = $props();
</script>

<div class="w-64 bg-white border-r border-gray-200 flex flex-col">
	<!-- Sidebar Header -->
	<div class="p-4 border-b border-gray-200">
		<h2 class="text-lg font-semibold text-gray-900">Projects</h2>
		<p class="text-xs text-gray-500 mt-1">{projects.length} total</p>
	</div>

	<!-- Projects List -->
	<div class="flex-1 overflow-y-auto">
		<div class="p-2 space-y-1">
			{#each projects as project (project.dTag || project.id)}
				{@const isOpen = openProjects.isOpen(project)}
				{@const projectId = project.tagId()}
				{@const isOnline = projectStatusStore.isProjectOnline(projectId)}
				{@const onlineAgents = projectStatusStore.getOnlineAgents(projectId)}
				<button
					onclick={() => openProjects.toggle(project)}
					class={cn(
						'w-full text-left px-3 py-2 rounded-lg transition-all',
						isOpen
							? 'bg-blue-50 border border-blue-200 text-blue-900'
							: 'hover:bg-gray-100 text-gray-700'
					)}
				>
					<div class="flex items-center gap-2">
						<!-- Project Avatar/Color -->
						<div
							class="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 relative"
							style="background: hsl({(project.dTag || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360}, 65%, 55%)"
						>
							{project.title?.charAt(0).toUpperCase() || 'P'}

							<!-- Online Status Indicator -->
							{#if isOnline}
								<div
									class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-lg shadow-green-500/50"
									title="Project is online"
								></div>
							{/if}
						</div>

						<div class="flex-1 min-w-0">
							<div class="font-medium text-sm truncate">{project.title || 'Untitled'}</div>
							<div class="text-xs text-gray-500 flex items-center gap-2">
								{#if onlineAgents.length > 0}
									<span class="text-green-600 font-medium">{onlineAgents.length} online</span>
								{:else}
									<span>{project.agents.length} agents</span>
								{/if}
								{#if isOpen}
									<span class="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
								{/if}
							</div>
						</div>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<!-- Sidebar Footer -->
	<div class="p-4 border-t border-gray-200">
		<button
			onclick={() => openProjects.closeAll()}
			class="w-full text-sm text-gray-600 hover:text-gray-900 py-2"
		>
			Close All Projects
		</button>
	</div>
</div>
