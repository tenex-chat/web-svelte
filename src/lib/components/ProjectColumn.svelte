<script lang="ts">
	import type { NDKProject } from '$lib/events/NDKProject';
	import { ndk } from '$lib/ndk.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { globalFilterStore } from '$lib/stores/globalFilter.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { cn } from '$lib/utils/cn';
	import { generateColorFromString } from '$lib/utils/colors';
	import { MessageSquare, FileText, Bot, Hash, Rss, Settings as SettingsIcon, Plus, Phone, Archive } from 'lucide-svelte';
	import { User } from "$lib/ndk/ui/user";
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { toastStore } from '$lib/stores/toast.svelte';

	interface Props {
		project: NDKProject;
		class?: string;
	}

	let { project, class: className }: Props = $props();

	type TabType = 'conversations' | 'docs' | 'agents' | 'hashtags' | 'feed';

	let activeTab = $state<TabType>('conversations');
	let showCreateDocDialog = $state(false);

	// Get project status from centralized store
	const projectId = $derived(project.tagId());
	const isOnline = $derived(projectStatusStore.isProjectOnline(projectId));
	const onlineAgents = $derived(projectStatusStore.getOnlineAgents(projectId));

	// Get global filter state for UI display
	const showArchived = $derived(globalFilterStore.showArchived);

	// Handle status indicator click to start project
	async function handleStatusClick() {
		if (isOnline || !ndk) return;

		try {
			// Create a 24000 event to start the project
			const event = new NDKEvent(ndk);
			event.kind = NDKKind.TenexProjectStart;
			event.content = '';

			// Tag the project using its NIP-33 reference
			const projectTag = project.tagId();
			if (projectTag) {
				event.tags.push(['a', projectTag]);
			}

			event.publish();
		} catch (error) {
			console.error('Failed to start project:', error);
			toastStore.error('Failed to send project start event');
		}
	}

	// Generate project color for UI accents
	const projectColor = $derived(generateColorFromString(project.dTag || ''));

	const tabs = [
		{ id: 'conversations', label: 'Chat', icon: MessageSquare },
		{ id: 'docs', label: 'Docs', icon: FileText },
		{ id: 'agents', label: 'Agents', icon: Bot },
		{ id: 'hashtags', label: 'Tags', icon: Hash },
		{ id: 'feed', label: 'Feed', icon: Rss }
	] as const;

	// Long-press handling for new conversation button
	const LONG_PRESS_DURATION = 500; // ms
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	let isLongPressing = $state(false);
	let startPosition = { x: 0, y: 0 };

	function handleNewChatPointerDown(e: PointerEvent) {
		if (e.button !== 0) return; // Only handle left click
		startPosition = { x: e.clientX, y: e.clientY };
		isLongPressing = false;

		longPressTimer = setTimeout(() => {
			isLongPressing = true;
			// Open as detached window at pointer position
			windowManager.openChatDetached(project, undefined, {
				x: e.clientX + 20,
				y: Math.max(50, e.clientY - 100)
			});
		}, LONG_PRESS_DURATION);
	}

	function handleNewChatPointerMove(e: PointerEvent) {
		// Cancel long press if user moves too much (allows accidental movement)
		const moveThreshold = 10;
		const dx = Math.abs(e.clientX - startPosition.x);
		const dy = Math.abs(e.clientY - startPosition.y);

		if (dx > moveThreshold || dy > moveThreshold) {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		}
	}

	function handleNewChatPointerUp() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		// If not a long press, perform normal click action (open in drawer)
		if (!isLongPressing) {
			windowManager.openChat(project);
		}
		isLongPressing = false;
	}

	function handleNewChatPointerCancel() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		isLongPressing = false;
	}
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

				<!-- Settings Button -->
				<button
					onclick={() => windowManager.openSettings(project)}
					class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors"
					title="Project settings"
					aria-label="Project settings"
				>
					<SettingsIcon class="h-3.5 w-3.5" />
				</button>

				<!-- Status Indicator -->
				<button
					class={cn(
						'w-2 h-2 rounded-full transition-all',
						isOnline ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-muted-foreground cursor-pointer hover:bg-foreground'
					)}
					title={isOnline ? 'Project is online' : 'Click to start project'}
					aria-label={isOnline ? 'Project is online' : 'Click to start project'}
					onclick={handleStatusClick}
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
						<tab.icon class="w-4 h-4" />
						{#if activeTab === tab.id}
							<div
								class="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full"
								style="background-color: {projectColor.replace('55%', '65%')}"
							></div>
						{/if}
					</button>
				{/each}
			</div>

			<div class="flex items-center gap-1">
				<!-- Add button - shown for conversations and docs tabs -->
				{#if activeTab === 'conversations'}
					<button
						onclick={() => globalFilterStore.toggleShowArchived()}
						class={cn(
							"h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors",
							showArchived ? "text-primary" : "text-muted-foreground hover:text-foreground"
						)}
						title={showArchived ? "Hide archived" : "Show archived"}
						aria-label={showArchived ? "Hide archived" : "Show archived"}
					>
						<Archive class="w-3.5 h-3.5" />
					</button>

					<button
						onpointerdown={handleNewChatPointerDown}
						onpointermove={handleNewChatPointerMove}
						onpointerup={handleNewChatPointerUp}
						onpointercancel={handleNewChatPointerCancel}
						onpointerleave={handleNewChatPointerCancel}
						class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors"
						title="New conversation (long-press for detached window)"
						aria-label="New conversation (long-press for detached window)"
					>
						<Plus class="w-3.5 h-3.5" />
					</button>

					<button
						onclick={() => windowManager.openCall(project)}
						class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors"
						title="Voice call"
						aria-label="Voice call"
					>
						<Phone class="w-3.5 h-3.5" />
					</button>
				{:else if activeTab === 'docs'}
					<button
						onclick={() => showCreateDocDialog = true}
						class="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground dark:hover:text-foreground rounded hover:bg-muted transition-colors"
						title="New document"
						aria-label="New document"
					>
						<Plus class="w-3.5 h-3.5" />
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-hidden relative">
		{#if activeTab === 'conversations'}
			{#await import('./chat/ConversationsTab.svelte') then { default: ConversationsTab }}
				<ConversationsTab {project} />
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
							<User.Root {ndk} pubkey={agent.pubkey}>
								<button
									onclick={() => windowManager.openAgent(project, agent.pubkey, agent.name)}
									class="w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b border-border flex items-center gap-3"
								>
									<!-- Avatar -->
									<User.Avatar class="w-6 h-6" />

									<!-- Agent Info -->
									<div class="flex-1 min-w-0">
										<div class="font-medium text-sm text-foreground"><User.Name /></div>
										<div class="flex items-center gap-1.5 text-xs text-green-600">
											<span class="w-1.5 h-1.5 rounded-full bg-green-600"></span>
											<span>Online</span>
										</div>
									</div>

									<!-- Chevron -->
									<svg class="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</button>
							</User.Root>
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
						// Check if this is a reply (has e-tags) or a root (no e-tags)
						const eTags = event.tags.filter((tag) => tag[0] === 'e');
						if (eTags.length > 0) {
							// Reply event - find and open the root conversation
							const rootId = eTags[0][1];
							if (rootId) {
								const rootEvent = await ndk.fetchEvent(rootId);
								if (rootEvent) {
									windowManager.openChat(project, rootEvent);
								}
							}
						} else {
							// Root event or other kinds - open directly
							windowManager.openChat(project, event);
						}
					}}
				/>
			{/await}
		{/if}
	</div>
</div>

<!-- Document Creation Dialog -->
{#await import('./docs/DocumentCreateDialog.svelte') then { default: DocumentCreateDialog }}
	<DocumentCreateDialog
		bind:open={showCreateDocDialog}
		{project}
	/>
{/await}
