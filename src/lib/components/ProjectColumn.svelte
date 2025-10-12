<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		project: NDKProject;
		class?: string;
	}

	let { project, class: className }: Props = $props();

	type TabType = 'conversations' | 'docs' | 'agents' | 'hashtags' | 'feed' | 'settings';

	let activeTab = $state<TabType>('conversations');

	// Get project status from centralized store
	const projectId = $derived(project.tagId());
	const projectStatus = $derived(projectStatusStore.getStatus(projectId));
	const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
	const onlineAgents = $derived(projectStatusStore.getOnlineAgents(projectId));

	// Generate project color for UI accents
	const projectColor = $derived.by(() => {
		const str = project.dTag || '';
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash = hash & hash;
		}
		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 65%, 55%)`;
	});

	const tabs = [
		{ id: 'conversations', label: 'Chat', icon: '💬' },
		{ id: 'docs', label: 'Docs', icon: '📄' },
		{ id: 'agents', label: 'Agents', icon: '🤖' },
		{ id: 'hashtags', label: 'Tags', icon: '#' },
		{ id: 'feed', label: 'Feed', icon: '📡' },
		{ id: 'settings', label: 'Settings', icon: '⚙️' }
	] as const;
</script>

<div class={cn('w-96 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 relative', className)}>
	<!-- Glow effect at top -->
	<div
		class="absolute top-0 left-0 right-0 h-32 pointer-events-none"
		style="background: linear-gradient(to bottom, {projectColor.replace('55%', '60%').replace('65%', '70%').replace(')', ', 0.18)')}, transparent)"
	></div>

	<!-- Column Header -->
	<div class="border-b border-gray-200 relative">
		<div class="px-3 py-2">
			<div class="flex items-center gap-2">
				<!-- Project Avatar -->
				<div
					class="w-6 h-6 rounded flex items-center justify-center text-white font-semibold text-xs"
					style="background: {projectColor}"
				>
					{project.title?.charAt(0).toUpperCase() || 'P'}
				</div>

				<!-- Project Title -->
				<h3 class="font-medium text-sm truncate flex-1">{project.title || 'Untitled Project'}</h3>

				<!-- Status Indicator -->
				<button
					class={cn(
						'w-2 h-2 rounded-full transition-all',
						isOnline ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-300'
					)}
					title={isOnline ? 'Project is online' : 'Project is offline'}
					aria-label={isOnline ? 'Project is online' : 'Project is offline'}
				></button>
			</div>
		</div>

		<!-- Tab Bar -->
		<div class="flex items-center justify-between px-2 pb-1">
			<div class="flex gap-1">
				{#each tabs as tab (tab.id)}
					<button
						onclick={() => (activeTab = tab.id)}
						class={cn(
							'px-3 py-1.5 relative transition-all rounded-sm group text-xs',
							activeTab === tab.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
						)}
						style={activeTab === tab.id
							? `background-color: ${projectColor.replace(')', ', 0.12)')}`
							: ''}
						title={tab.label}
					>
						<span class="text-base leading-none">{tab.icon}</span>
						{#if activeTab === tab.id}
							<div
								class="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
								style="background-color: {projectColor.replace('55%', '65%')}"
							></div>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Add button -->
			{#if activeTab === 'conversations' || activeTab === 'docs' || activeTab === 'agents'}
				<button
					class="h-6 w-6 flex items-center justify-center text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
					title="Add new"
					aria-label="Add new"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-hidden bg-gray-50">
		{#if activeTab === 'conversations'}
			{#await import('./chat/ConversationsTab.svelte') then { default: ConversationsTab }}
				<ConversationsTab {project} {onlineAgents} />
			{/await}
		{:else if activeTab === 'docs'}
			<div class="h-full flex items-center justify-center text-gray-500 text-sm">
				Documentation (TODO)
			</div>
		{:else if activeTab === 'agents'}
			<div class="h-full p-2">
				{#if onlineAgents.length === 0}
					<div class="flex flex-col items-center justify-center h-32 text-center">
						<span class="text-3xl mb-2">🤖</span>
						<p class="text-sm text-gray-500">No agents online</p>
					</div>
				{:else}
					<div class="space-y-1">
						{#each onlineAgents as agent (agent.pubkey)}
							<button
								onclick={() => windowManager.openAgent(project, agent.pubkey, agent.name)}
								class="w-full text-left px-3 py-2 rounded hover:bg-white transition-colors border border-gray-200"
							>
								<div class="font-medium text-sm">{agent.name}</div>
								{#if agent.model}
									<div class="text-xs text-gray-500">{agent.model}</div>
								{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{:else if activeTab === 'hashtags'}
			<div class="h-full flex items-center justify-center text-gray-500 text-sm">
				Hashtags (TODO)
			</div>
		{:else if activeTab === 'feed'}
			<div class="h-full flex items-center justify-center text-gray-500 text-sm">
				Feed (TODO)
			</div>
		{:else if activeTab === 'settings'}
			<div class="h-full flex flex-col items-center justify-center gap-3 text-center p-4">
				<span class="text-4xl">⚙️</span>
				<button
					onclick={() => windowManager.openSettings(project)}
					class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
				>
					Open Settings
				</button>
				<p class="text-xs text-gray-500">Settings will open in a drawer</p>
			</div>
		{/if}
	</div>
</div>
