<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { cn } from '$lib/utils/cn';
	import { MessageSquare, FileText, Bot, Hash, Rss, Settings as SettingsIcon, Filter, Clock, MoreVertical, MessageCircleQuestion } from 'lucide-svelte';
	import * as DropdownMenu from './ui/dropdown-menu';

	interface Props {
		project: NDKProject;
		class?: string;
	}

	let { project, class: className }: Props = $props();

	type TabType = 'conversations' | 'docs' | 'agents' | 'hashtags' | 'feed' | 'settings';

	let activeTab = $state<TabType>('conversations');
	let timeFilter = $state<string | null>(null);
	let filterDropdownOpen = $state(false);
	let showCreateDocDialog = $state(false);

	// Get project status from centralized store
	const projectId = $derived(project.tagId());
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
		{ id: 'conversations', label: 'Chat', icon: MessageSquare },
		{ id: 'docs', label: 'Docs', icon: FileText },
		{ id: 'agents', label: 'Agents', icon: Bot },
		{ id: 'hashtags', label: 'Tags', icon: Hash },
		{ id: 'feed', label: 'Feed', icon: Rss },
		{ id: 'settings', label: 'Settings', icon: SettingsIcon }
	] as const;
</script>

<div class={cn('w-96 flex-shrink-0 flex flex-col bg-card border-r border-border relative', className)}>
	<!-- Glow effect at top -->
	<div
		class="absolute top-0 left-0 right-0 h-96 pointer-events-none z-0"
		style="background: linear-gradient(to bottom, {projectColor.replace('55%', '65%').replace('65%', '75%').replace(')', ', 0.25)')}, {projectColor.replace('55%', '55%').replace('65%', '65%').replace(')', ', 0.05)')} 70%, transparent)"
	></div>

	<!-- Column Header -->
	<div class="border-b border-border relative z-10">
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
				<h3 class="font-medium text-sm truncate flex-1 text-foreground">{project.title || 'Untitled Project'}</h3>

				<!-- Activity Filter Button (only for conversations tab) -->
				{#if activeTab === 'conversations'}
					<DropdownMenu.Root bind:open={filterDropdownOpen}>
						<DropdownMenu.Trigger asChild>
							<button
								class={cn(
									'h-6 w-6 p-0 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors',
									timeFilter && 'text-primary dark:text-blue-400'
								)}
								title="Activity filters"
								aria-label="Activity filters"
							>
								{#if timeFilter}
									<Filter class="h-3.5 w-3.5" />
								{:else}
									<MoreVertical class="h-3.5 w-3.5" />
								{/if}
							</button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="w-56">
							<DropdownMenu.Item onclick={() => (timeFilter = null)}>
								<Clock class="mr-2 h-4 w-4" />
								<span>All conversations</span>
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Group>
								<DropdownMenu.GroupHeading>Activity filters</DropdownMenu.GroupHeading>
							<DropdownMenu.Item onclick={() => (timeFilter = '1h')}>
								<Clock class="mr-2 h-4 w-4" />
								<span>Active in last hour</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (timeFilter = '4h')}>
								<Clock class="mr-2 h-4 w-4" />
								<span>Active in last 4 hours</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (timeFilter = '1d')}>
								<Clock class="mr-2 h-4 w-4" />
								<span>Active in last 24 hours</span>
							</DropdownMenu.Item>
							</DropdownMenu.Group>
							<DropdownMenu.Separator />
							<DropdownMenu.Group>
								<DropdownMenu.GroupHeading>Response filters</DropdownMenu.GroupHeading>
							<DropdownMenu.Item onclick={() => (timeFilter = 'needs-response-1h')}>
								<MessageCircleQuestion class="mr-2 h-4 w-4" />
								<span>Needs response (1h)</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (timeFilter = 'needs-response-4h')}>
								<MessageCircleQuestion class="mr-2 h-4 w-4" />
								<span>Needs response (4h)</span>
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => (timeFilter = 'needs-response-1d')}>
								<MessageCircleQuestion class="mr-2 h-4 w-4" />
								<span>Needs response (24h)</span>
							</DropdownMenu.Item>
							</DropdownMenu.Group>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{/if}

				<!-- Status Indicator -->
				<button
					class={cn(
						'w-2 h-2 rounded-full transition-all',
						isOnline ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-300 dark:bg-gray-600'
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
							activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground dark:hover:text-foreground'
						)}
						style={activeTab === tab.id
							? `background-color: ${projectColor.replace(')', ', 0.12)')}`
							: ''}
						title={tab.label}
					>
						<svelte:component this={tab.icon} class="w-4 h-4" />
						{#if activeTab === tab.id}
							<div
								class="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
								style="background-color: {projectColor.replace('55%', '65%')}"
							></div>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Add button - shown for conversations and docs tabs -->
			{#if activeTab === 'conversations'}
				<button
					onclick={() => windowManager.openChat(project)}
					class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors"
					title="New conversation"
					aria-label="New conversation"
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
			{:else if activeTab === 'docs'}
				<button
					onclick={() => showCreateDocDialog = true}
					class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors"
					title="New document"
					aria-label="New document"
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
	<div class="flex-1 overflow-hidden relative">
		{#if activeTab === 'conversations'}
			{#await import('./chat/ConversationsTab.svelte') then { default: ConversationsTab }}
				<ConversationsTab {project} {onlineAgents} {timeFilter} />
			{/await}
		{:else if activeTab === 'docs'}
			{#await import('./docs/DocsTab.svelte') then { default: DocsTab }}
				<DocsTab {project} />
			{/await}
		{:else if activeTab === 'agents'}
			<div class="h-full">
				{#if onlineAgents.length === 0}
					<div class="flex flex-col items-center justify-center h-32 text-center">
						<Bot class="w-12 h-12 text-muted-foreground mb-2" />
						<p class="text-sm text-muted-foreground">No agents online</p>
					</div>
				{:else}
					<div>
						{#each onlineAgents as agent (agent.pubkey)}
							{#await import('@nostr-dev-kit/svelte') then { Avatar }}
								<button
									onclick={() => windowManager.openAgent(project, agent.pubkey, agent.name)}
									class="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border flex items-center gap-3"
								>
									<!-- Avatar -->
									<Avatar.Avatar {ndk} pubkey={agent.pubkey} size={40} />

									<!-- Agent Info -->
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm text-foreground">{agent.name}</div>
										<div class="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
											<span class="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-400"></span>
											<span>Online</span>
										</div>
									</div>

									<!-- Chevron -->
									<svg class="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</button>
							{/await}
						{/each}
					</div>
				{/if}
			</div>
		{:else if activeTab === 'hashtags'}
			<div class="h-full flex items-center justify-center text-muted-foreground text-sm">
				Hashtags (TODO)
			</div>
		{:else if activeTab === 'feed'}
			{#await import('./feed/FeedTab.svelte') then { default: FeedTab }}
				<FeedTab
					{project}
					onEventClick={async (event) => {
						if (event.kind === 1111) {
							// Reply event - find and open the parent conversation
							const eTags = event.tags.filter((tag) => tag[0] === 'e');
							if (eTags.length > 0) {
								const parentId = eTags[0][1];
								if (parentId) {
									// Fetch the parent event and open it
									const parentEvent = await ndk.fetchEvent(parentId);
									if (parentEvent) {
										windowManager.openChat(project, parentEvent);
									}
								}
							}
						} else {
							// For other events (kind 1, kind 24133, etc), open directly
							windowManager.openChat(project, event);
						}
					}}
				/>
			{/await}
		{:else if activeTab === 'settings'}
			<div class="h-full flex flex-col items-center justify-center gap-3 text-center p-4">
				<SettingsIcon class="w-16 h-16 text-muted-foreground" />
				<button
					onclick={() => windowManager.openSettings(project)}
					class="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors font-medium"
				>
					Open Settings
				</button>
				<p class="text-xs text-muted-foreground">Settings will open in a drawer</p>
			</div>
		{/if}
	</div>
</div>

<!-- Document Creation Dialog -->
{#await import('./docs/DocumentCreateDialog.svelte') then { default: DocumentCreateDialog }}
	<DocumentCreateDialog
		bind:open={showCreateDocDialog}
		{project}
		onClose={() => showCreateDocDialog = false}
	/>
{/await}
