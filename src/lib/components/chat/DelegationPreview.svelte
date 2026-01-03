<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
	import { aggregateTodoState } from '$lib/utils/todoAggregator';
	import { parseKind24133, stopEvent } from '$lib/ndk-events/operations';
	import { onDestroy } from 'svelte';
	import { Check, Circle, Loader2, Square } from 'lucide-svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { User } from '$lib/ndk/ui/user';

	interface Props {
		conversationId: string;
	}

	let { conversationId }: Props = $props();

	let events = $state<NDKEvent[]>([]);
	let subscription: NDKSubscription | null = null;
	let operationsSubscription: NDKSubscription | null = null;

	// Track latest operations status (kind 24133)
	let latestOperations = $state<{ agentPubkeys: string[]; createdAt: number } | null>(null);

	// Root event (the delegation conversation itself)
	const rootEvent = $derived(events.find(e => e.id === conversationId));

	// Delegated-to agent pubkey (from root event's p-tag)
	const agentPubkey = $derived(rootEvent?.tags?.find(t => t[0] === 'p')?.[1]);

	// Aggregate todos from events
	const todoState = $derived.by(() => {
		const sortedEvents = [...events].sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
		return aggregateTodoState(sortedEvents);
	});

	// Get most recent kind:1 event
	const mostRecentEvent = $derived.by(() => {
		return [...events]
			.filter(e => e.kind === 1)
			.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0] || null;
	});

	// Get most recent message (non-tool event with content) for display
	const recentMessage = $derived.by(() => {
		const sortedEvents = [...events]
			.filter(e => {
				// Exclude tool events
				const hasToolTag = e.tags?.some(t => t[0] === 'tool');
				return !hasToolTag && e.content && e.content.trim().length > 0;
			})
			.sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
		return sortedEvents[0] || null;
	});

	// Calculate progress
	const progress = $derived.by(() => {
		if (!todoState.hasTodos) return null;
		const completed = todoState.items.filter(t => t.status === 'done' || t.status === 'completed').length;
		const total = todoState.items.length;
		return { completed, total, percent: Math.round((completed / total) * 100) };
	});

	// Status: done if no agents working (from 24133) OR if last message is delegatee p-tagging delegator
	const status = $derived.by(() => {
		// If we have operations status and no agents are working, it's done
		if (latestOperations && latestOperations.agentPubkeys.length === 0) {
			return 'done';
		}

		// Fallback: check message pattern
		if (!rootEvent || !mostRecentEvent) return 'working';

		// Delegator = author of the root event
		const delegatorPubkey = rootEvent.pubkey;
		// Delegated-to agent = p-tagged in the root event
		const delegatedToPubkey = rootEvent.tags?.find(t => t[0] === 'p')?.[1];

		if (!delegatedToPubkey) return 'working';

		// Check if last event is from delegated agent and p-tags the delegator
		const lastEventFromDelegate = mostRecentEvent.pubkey === delegatedToPubkey;
		const lastEventTagsDelegator = mostRecentEvent.tags?.some(
			t => t[0] === 'p' && t[1] === delegatorPubkey
		);

		if (lastEventFromDelegate && lastEventTagsDelegator) {
			return 'done';
		}

		return 'working';
	});

	// Format relative time
	function formatRelativeTime(timestamp: number): string {
		const now = Math.floor(Date.now() / 1000);
		const diff = now - timestamp;

		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	// Open delegation in detached window
	async function handleClick() {
		if (!rootEvent) return;

		// Extract project from 'a' tag (format: kind:pubkey:d-tag)
		const aTag = rootEvent.tags?.find(t => t[0] === 'a')?.[1];
		let project: NDKProject | null = null;

		if (aTag) {
			const [kindStr, pubkey, dTag] = aTag.split(':');
			if (kindStr && pubkey && dTag) {
				const projectEvent = await ndk.fetchEvent({
					kinds: [parseInt(kindStr)],
					authors: [pubkey],
					'#d': [dTag]
				});
				if (projectEvent) {
					project = NDKProject.from(projectEvent);
				}
			}
		}

		if (project) {
			// Open chat and immediately detach it
			const windowId = windowManager.openChat(project, rootEvent);
			// Position near center of screen
			const x = Math.max(100, (globalThis.innerWidth - 600) / 2);
			const y = Math.max(50, (globalThis.innerHeight - 700) / 2);
			windowManager.detach(windowId, { x, y });
		}
	}

	// Stop the delegated work
	async function handleStop(e: MouseEvent) {
		e.stopPropagation(); // Don't trigger the card click
		if (!projectId || !conversationId) return;
		await stopEvent(ndk, projectId, conversationId);
	}

	// Extract project ID from root event's 'a' tag
	const projectId = $derived(rootEvent?.tags?.find(t => t[0] === 'a')?.[1]);

	// Subscribe to conversation events
	$effect(() => {
		if (!conversationId) return;

		// Clear previous state
		events = [];

		const filters: NDKFilter[] = [
			{ ids: [conversationId] },
			{ '#e': [conversationId] }
		];

		subscription = ndk.subscribe(filters, {
			onEvent: (event: NDKEvent) => {
				events = [...events, event];
			},
			onEvents: (e: NDKEvent[]) => {
				events = e
			}
		});

		return () => {
			subscription?.stop();
		};
	});

	// Subscribe to operations status (kind 24133)
	$effect(() => {
		if (!conversationId || !projectId) return;

		operationsSubscription = ndk.subscribe(
			[{
				kinds: [24133],
				'#a': [projectId],
				'#e': [conversationId]
			}],
			{
				closeOnEose: false,
				onEvent: (event: NDKEvent) => {
					const snapshot = parseKind24133(event);
					if (!snapshot) return;

					// Last-write-wins: only update if newer
					if (!latestOperations || snapshot.createdAt > latestOperations.createdAt) {
						latestOperations = {
							agentPubkeys: snapshot.agentPubkeys,
							createdAt: snapshot.createdAt
						};
					}
				}
			}
		);

		return () => {
			operationsSubscription?.stop();
		};
	});

	onDestroy(() => {
		subscription?.stop();
		operationsSubscription?.stop();
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="delegation-preview" onclick={handleClick}>
	<div class="delegation-header">
		{#if agentPubkey}
			<User.Root {ndk} pubkey={agentPubkey}>
				<User.Avatar class="w-6 h-6 rounded-full flex-shrink-0" />
				<div class="delegation-title">
					<div class="agent-name"><User.Name /></div>
					{#if rootEvent?.content}
						<div class="prompt-preview" title={rootEvent.content}>{rootEvent.content}</div>
					{/if}
				</div>
			</User.Root>
		{:else}
			<div class="agent-avatar">?</div>
			<div class="delegation-title">
				<div class="agent-name">Agent</div>
			</div>
		{/if}
		<span class="delegation-status" class:working={status === 'working'}>
			{status}
		</span>
		{#if status === 'working'}
			<button
				class="stop-button"
				onclick={handleStop}
				title="Stop delegation"
			>
				<Square class="w-3 h-3" />
			</button>
		{/if}
	</div>

	{#if events.length > 0}
		{#if todoState.hasTodos}
			<div class="todo-section">
				<div class="todo-section-header">
					{#if progress}
						Progress ({progress.completed}/{progress.total})
					{:else}
						Tasks
					{/if}
				</div>
				<ul class="todo-list">
					{#each todoState.items as item (item.id)}
						<li class="todo-item">
							<div class="todo-checkbox"
								class:completed={item.status === 'done' || item.status === 'completed'}
								class:in-progress={item.status === 'in_progress'}>
								{#if item.status === 'done' || item.status === 'completed'}
									<Check class="w-2.5 h-2.5" />
								{:else if item.status === 'in_progress'}
									<Loader2 class="w-2 h-2 animate-spin" />
								{/if}
							</div>
							<span class="todo-text" class:completed={item.status === 'done' || item.status === 'completed'}>
								{item.title}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if recentMessage}
			<div class="recent-message">
				<div class="recent-message-header">Latest Activity</div>
				<div class="message-content">
					{recentMessage.content}
				</div>
				{#if recentMessage.created_at}
					<div class="message-timestamp">
						{formatRelativeTime(recentMessage.created_at)}
					</div>
				{/if}
			</div>
		{:else if !todoState.hasTodos}
			<div class="empty-state">
				<Circle class="w-4 h-4 animate-pulse" />
				<span>Waiting for activity...</span>
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<Circle class="w-4 h-4 animate-pulse" />
			<span>Waiting for activity...</span>
		</div>
	{/if}
</div>

<style>
	.delegation-preview {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
		overflow: hidden;
		max-width: 320px;
		margin-top: 8px;
		cursor: pointer;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.delegation-preview:hover {
		border-color: hsl(var(--primary) / 0.5);
		box-shadow: 0 0 0 1px hsl(var(--primary) / 0.1);
	}

	.delegation-header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.3);
	}

	.agent-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
		color: hsl(var(--primary-foreground));
		flex-shrink: 0;
	}

	.delegation-title {
		flex: 1;
		min-width: 0;
	}

	.delegation-title .agent-name {
		font-weight: 600;
		font-size: 12px;
	}

	.delegation-title .prompt-preview {
		color: hsl(var(--muted-foreground));
		font-size: 10px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.delegation-status {
		font-size: 9px;
		padding: 2px 8px;
		border-radius: 10px;
		background: hsl(142 76% 36% / 0.2);
		color: hsl(142 76% 46%);
		flex-shrink: 0;
	}

	.delegation-status.working {
		background: hsl(45 93% 47% / 0.2);
		color: hsl(45 93% 47%);
		animation: pulse 2s infinite;
	}

	.stop-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: none;
		background: hsl(0 84% 60% / 0.15);
		color: hsl(0 84% 60%);
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s ease;
	}

	.stop-button:hover {
		background: hsl(0 84% 60% / 0.3);
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.todo-section {
		padding: 10px 12px;
		border-bottom: 1px solid hsl(var(--border));
	}

	.todo-section-header {
		font-size: 9px;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
		margin-bottom: 6px;
		letter-spacing: 0.5px;
	}

	.todo-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.todo-item {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 3px 0;
		font-size: 11px;
	}

	.todo-checkbox {
		width: 14px;
		height: 14px;
		border: 1.5px solid hsl(var(--border));
		border-radius: 3px;
		flex-shrink: 0;
		margin-top: 1px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: hsl(var(--background));
	}

	.todo-checkbox.completed {
		background: hsl(142 76% 36%);
		border-color: hsl(142 76% 36%);
	}

	.todo-checkbox.in-progress {
		border-color: hsl(45 93% 47%);
		color: hsl(45 93% 47%);
	}

	.todo-text {
		color: hsl(var(--foreground));
		line-height: 1.3;
	}

	.todo-text.completed {
		color: hsl(var(--muted-foreground));
		text-decoration: line-through;
	}

	.recent-message {
		padding: 10px 12px;
	}

	.recent-message-header {
		font-size: 9px;
		text-transform: uppercase;
		color: hsl(var(--muted-foreground));
		margin-bottom: 6px;
		letter-spacing: 0.5px;
	}

	.message-content {
		font-size: 11px;
		line-height: 1.4;
		color: hsl(var(--foreground));
		max-height: 50px;
		overflow: hidden;
		position: relative;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
	}

	.message-timestamp {
		font-size: 9px;
		color: hsl(var(--muted-foreground));
		margin-top: 4px;
	}

	.empty-state {
		padding: 16px 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		color: hsl(var(--muted-foreground));
		font-size: 11px;
	}
</style>
