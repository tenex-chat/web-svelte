<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKSubscriptionCacheUsage, type NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { isRootThread, getParentIds } from '$lib/stores/threadStore.svelte';
	import { generateColorFromString } from '$lib/utils/colors';
	import { MessageSquare, Circle } from 'lucide-svelte';
	import TimeAgo from '$lib/components/common/TimeAgo.svelte';

	interface ConversationWithProject {
		thread: NDKEvent;
		project: NDKProject;
		statusLabel: string | undefined;
		statusCurrentActivity: string | undefined;
		title: string;
		replyCount: number;
		latestReplyTime: number;
	}

	// Subscribe to threads from all opened projects with a single subscription
	let allThreads = $state<Map<string, NDKEvent[]>>(new Map());
	let threadMetadataMap = $state<Map<string, { replyCount: number; latestReplyTime: number }>>(new Map());

	$effect(() => {
		const projects = openProjects.projects;
		const projectTagIds = projects.map((p) => p.tagId()).filter((id): id is string => !!id);

		if (projectTagIds.length === 0) {
			allThreads = new Map();
			threadMetadataMap = new Map();
			return;
		}

		const projectThreads = new Map<string, NDKEvent[]>();
		const metadataMap = new Map<string, { replyCount: number; latestReplyTime: number }>();

		const subscription = ndk.subscribe(
			[
				{
					kinds: [1],
					'#a': projectTagIds,
					limit: 500
				}
			],
			{
				cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
				groupable: false,
				subId: 'global-status',
				cacheUnconstrainFilter: []
			},
			{
				onEvent: (event: NDKEvent) => {
					// Find which project this event belongs to via its 'a' tag
					const aTag = event.tags.find((t) => t[0] === 'a' && projectTagIds.includes(t[1]));
					if (!aTag) return;
					const projectTagId = aTag[1];

					if (isRootThread(event)) {
						// Root thread
						const existing = projectThreads.get(projectTagId) || [];
						if (!existing.find((e) => e.id === event.id)) {
							projectThreads.set(projectTagId, [...existing, event]);
							allThreads = new Map(projectThreads);
						}
					} else {
						// Reply - update metadata
						for (const threadId of getParentIds(event)) {
							const existing = metadataMap.get(threadId) || { replyCount: 0, latestReplyTime: 0 };
							existing.replyCount++;
							if ((event.created_at || 0) > existing.latestReplyTime) {
								existing.latestReplyTime = event.created_at || 0;
							}
							metadataMap.set(threadId, existing);
							threadMetadataMap = new Map(metadataMap);
						}
					}
				}
			}
		);

		return () => subscription.stop();
	});

	// Build conversations with their project info and status
	const conversationsWithStatus = $derived.by(() => {
		const projects = openProjects.projects;
		const result: ConversationWithProject[] = [];

		for (const project of projects) {
			const projectTagId = project.tagId();
			if (!projectTagId) continue;

			const threads = allThreads.get(projectTagId) || [];

			for (const thread of threads) {
				const metadata = conversationMetadataStore.getConversationData(thread.id);
				const threadMeta = threadMetadataMap.get(thread.id);

				result.push({
					thread,
					project,
					statusLabel: metadata.statusLabel,
					statusCurrentActivity: metadata.statusCurrentActivity,
					title: metadata.title || thread.tagValue('title') || thread.content?.slice(0, 50) || 'Untitled',
					replyCount: threadMeta?.replyCount || 0,
					latestReplyTime: threadMeta?.latestReplyTime || thread.created_at || 0
				});
			}
		}

		return result;
	});

	// Dynamically discover all unique status labels and group conversations
	const groupedByStatus = $derived.by(() => {
		const groups = new Map<string, ConversationWithProject[]>();

		for (const conv of conversationsWithStatus) {
			if (!conv.statusLabel) continue;

			const existing = groups.get(conv.statusLabel) || [];
			existing.push(conv);
			groups.set(conv.statusLabel, existing);
		}

		// Sort each group by latest activity
		for (const [, convs] of groups) {
			convs.sort((a, b) => b.latestReplyTime - a.latestReplyTime);
		}

		return groups;
	});

	// Get uncategorized conversations (no status label)
	const uncategorizedConversations = $derived.by(() => {
		return conversationsWithStatus
			.filter((conv) => !conv.statusLabel)
			.sort((a, b) => b.latestReplyTime - a.latestReplyTime);
	});

	// Get sorted list of status labels (by count, descending)
	const statusLabels = $derived.by(() => {
		return Array.from(groupedByStatus.keys()).sort((a, b) => {
			const countA = groupedByStatus.get(a)?.length || 0;
			const countB = groupedByStatus.get(b)?.length || 0;
			return countB - countA;
		});
	});

	// Total columns (status labels + uncategorized if any)
	const totalColumns = $derived(statusLabels.length + (uncategorizedConversations.length > 0 ? 1 : 0));

	// Generate color for a status label
	function getStatusColor(label: string): string {
		return generateColorFromString(label);
	}

	// Handle conversation click
	function handleConversationClick(conv: ConversationWithProject) {
		windowManager.openChat(conv.project, conv.thread);
	}
</script>

<div class="flex-1 flex flex-col h-full overflow-hidden p-6 bg-background">
	<!-- Header -->
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-foreground mb-2">Status Dashboard</h1>
		<p class="text-muted-foreground text-sm">
			Cross-project view of all conversations grouped by status
		</p>
	</div>

	{#if conversationsWithStatus.length === 0}
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<Circle class="w-16 h-16 text-muted-foreground mx-auto mb-4" />
				<h2 class="text-xl font-semibold text-foreground mb-2">No conversations yet</h2>
				<p class="text-muted-foreground">Open some projects to see their conversations here</p>
			</div>
		</div>
	{:else}
		<!-- Status Summary Bar -->
		<div class="flex gap-3 mb-6 flex-wrap">
			{#if uncategorizedConversations.length > 0}
				<div class="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 border-border">
					<div class="w-2 h-2 rounded-full bg-muted-foreground"></div>
					<span class="text-sm font-medium text-muted-foreground">{uncategorizedConversations.length} Uncategorized</span>
				</div>
			{/if}
			{#each statusLabels as label}
				{@const color = getStatusColor(label)}
				{@const count = groupedByStatus.get(label)?.length || 0}
				<div
					class="flex items-center gap-2 px-3 py-2 rounded-lg border"
					style="background-color: {color.replace(')', ', 0.1)')}; border-color: {color.replace(')', ', 0.3)')}"
				>
					<div
						class="w-2 h-2 rounded-full"
						style="background-color: {color}"
					></div>
					<span class="text-sm font-medium" style="color: {color}">{count} {label}</span>
				</div>
			{/each}
		</div>

		<!-- Kanban Board -->
		<div class="flex-1 overflow-x-auto">
			<div
				class="flex gap-4 h-full"
				style="min-width: {Math.max(totalColumns * 320, 800)}px"
			>
				<!-- Uncategorized Column -->
				{#if uncategorizedConversations.length > 0}
					<div class="w-80 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col h-full">
						<div class="px-4 py-3 border-b border-border flex-shrink-0 bg-muted/30">
							<div class="flex items-center gap-2">
								<div class="w-2 h-2 rounded-full bg-muted-foreground"></div>
								<span class="font-semibold text-sm text-foreground">Uncategorized</span>
								<span class="ml-auto text-xs text-muted-foreground">{uncategorizedConversations.length}</span>
							</div>
						</div>
						<div class="p-2 space-y-2 overflow-y-auto flex-1">
							{#each uncategorizedConversations as conv (conv.thread.id)}
								{@const projectColor = generateColorFromString(conv.project.dTag || '')}
								<button
									onclick={() => handleConversationClick(conv)}
									class="w-full text-left p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
								>
									<div class="font-medium text-sm mb-1 truncate text-foreground">{conv.title}</div>
									<div class="flex items-center gap-1.5 mb-2">
										<div
											class="w-3 h-3 rounded flex-shrink-0"
											style="background-color: {projectColor}"
										></div>
										<span class="text-xs text-muted-foreground truncate">{conv.project.title}</span>
									</div>
									<div class="flex items-center gap-3 text-xs text-muted-foreground">
										<div class="flex items-center gap-1">
											<MessageSquare class="w-3 h-3" />
											<span>{conv.replyCount}</span>
										</div>
										<TimeAgo timestamp={conv.latestReplyTime} class="ml-auto" />
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#each statusLabels as label}
					{@const color = getStatusColor(label)}
					{@const conversations = groupedByStatus.get(label) || []}
					<div class="w-80 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col h-full">
						<!-- Column Header -->
						<div
							class="px-4 py-3 border-b border-border flex-shrink-0"
							style="background-color: {color.replace(')', ', 0.05)')}"
						>
							<div class="flex items-center gap-2">
								<div
									class="w-2 h-2 rounded-full"
									style="background-color: {color}"
								></div>
								<span class="font-semibold text-sm text-foreground">{label}</span>
								<span class="ml-auto text-xs text-muted-foreground">{conversations.length}</span>
							</div>
						</div>

						<!-- Column Content -->
						<div class="p-2 space-y-2 overflow-y-auto flex-1">
							{#if conversations.length === 0}
								<div class="flex flex-col items-center justify-center h-24 text-center">
									<Circle class="w-8 h-8 text-muted-foreground/50 mb-2" />
									<p class="text-xs text-muted-foreground">No conversations</p>
								</div>
							{:else}
								{#each conversations as conv (conv.thread.id)}
									{@const projectColor = generateColorFromString(conv.project.dTag || '')}
									<button
										onclick={() => handleConversationClick(conv)}
										class="w-full text-left p-3 rounded-lg bg-muted hover:bg-muted/80 cursor-pointer transition-colors"
									>
										<!-- Title -->
										<div class="font-medium text-sm mb-1 truncate text-foreground">{conv.title}</div>

										<!-- Current Activity (if present) -->
										{#if conv.statusCurrentActivity}
											<div
												class="text-xs mb-2 flex items-center gap-1"
												style="color: {color}"
											>
												<svg class="w-3 h-3 animate-pulse flex-shrink-0" fill="currentColor" viewBox="0 0 8 8">
													<circle cx="4" cy="4" r="3" />
												</svg>
												<span class="truncate">{conv.statusCurrentActivity}</span>
											</div>
										{/if}

										<!-- Project Name -->
										<div class="flex items-center gap-1.5 mb-2">
											<div
												class="w-3 h-3 rounded flex-shrink-0"
												style="background-color: {projectColor}"
											></div>
											<span class="text-xs text-muted-foreground truncate">{conv.project.title}</span>
										</div>

										<!-- Footer with stats -->
										<div class="flex items-center gap-3 text-xs text-muted-foreground">
											<div class="flex items-center gap-1">
												<MessageSquare class="w-3 h-3" />
												<span>{conv.replyCount}</span>
											</div>
											<TimeAgo timestamp={conv.latestReplyTime} class="ml-auto" />
										</div>
									</button>
								{/each}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
