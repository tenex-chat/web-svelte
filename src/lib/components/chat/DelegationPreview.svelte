<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent, NDKSubscription, NDKFilter } from '@nostr-dev-kit/ndk';
	import { stopEvent } from '$lib/ndk-events/operations';
	import { onDestroy } from 'svelte';
	import { Circle, Square } from 'lucide-svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { User } from '$lib/ndk/ui/user';
	import { operationsStatusStore } from '$lib/stores/operationsStatus.svelte';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { generateColorFromString } from '$lib/utils/colors';

	interface Props {
		conversationId: string;
	}

	let { conversationId }: Props = $props();

	let events = $state<NDKEvent[]>([]);
	let subscription: NDKSubscription | null = null;

	// Root event (the delegation conversation itself)
	const rootEvent = $derived(events.find(e => e.id === conversationId));

	// Delegated-to agent pubkey (from root event's p-tag)
	const agentPubkey = $derived(rootEvent?.tags?.find(t => t[0] === 'p')?.[1]);

	// Get metadata from centralized store (reactive per-conversation)
	const metadata = $derived(conversationMetadataStore.getConversationData(conversationId));

	// Generate dynamic color from status label
	const statusColor = $derived(metadata.statusLabel ? generateColorFromString(metadata.statusLabel) : null);

	// Status: prefer metadata store's statusLabel, fallback to heuristics
	const status = $derived.by(() => {
		if (metadata.statusLabel) {
			const label = metadata.statusLabel.toLowerCase();
			if (label.includes('completed') || label.includes('done') || label.includes('finished')) {
				return 'done';
			}
			if (label.includes('progress') || label.includes('working') || label.includes('running')) {
				return 'working';
			}
		}

		// Check centralized operations store
		const workingAgents = operationsStatusStore.getWorkingAgents(conversationId);
		if (workingAgents.length === 0) {
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
			const windowId = windowManager.openChat(project, rootEvent);
			const x = Math.max(100, (globalThis.innerWidth - 600) / 2);
			const y = Math.max(50, (globalThis.innerHeight - 700) / 2);
			windowManager.detach(windowId, { x, y });
		}
	}

	// Stop the delegated work
	async function handleStop(e: MouseEvent) {
		e.stopPropagation();
		if (!projectId || !conversationId) return;
		await stopEvent(ndk, projectId, conversationId);
	}

	// Extract project ID from root event's 'a' tag
	const projectId = $derived(rootEvent?.tags?.find(t => t[0] === 'a')?.[1]);

	// Subscribe to conversation events
	$effect(() => {
		if (!conversationId) return;

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

	onDestroy(() => {
		subscription?.stop();
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="delegation-preview" onclick={handleClick}>
	<div class="delegation-header">
		{#if agentPubkey}
			<User.Root {ndk} pubkey={agentPubkey}>
				<User.Avatar class="avatar" />
				<div class="header-content">
					<div class="agent-name"><User.Name /></div>
					{#if metadata.title}
						<div class="title" title={metadata.title}>{metadata.title}</div>
					{:else if rootEvent?.content}
						<div class="prompt-line" title={rootEvent.content}>{rootEvent.content}</div>
					{/if}
				</div>
			</User.Root>
		{:else}
			<div class="avatar-placeholder">?</div>
			<div class="header-content">
				<div class="agent-name">Agent</div>
			</div>
		{/if}
		<div class="header-right">
			{#if metadata.statusLabel && statusColor}
				<span
					class="status-badge"
					style="background-color: {statusColor.replace(')', ', 0.2)')}; color: {statusColor}; border-color: {statusColor.replace(')', ', 0.3)')}"
				>
					{metadata.statusLabel}
				</span>
			{:else}
				<span class="status-badge status-fallback" class:working={status === 'working'}>
					{status}
				</span>
			{/if}
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
	</div>

	<div class="content">
		{#if metadata.statusCurrentActivity}
			<div class="activity-main" style={statusColor ? `color: ${statusColor}` : ''}>
				{#if status === 'working'}
					<span class="pulse" style={statusColor ? `background: ${statusColor}` : ''}></span>
				{/if}
				<span class="activity-text">{metadata.statusCurrentActivity}</span>
			</div>
			{#if metadata.summary}
				<div class="summary-muted">{metadata.summary}</div>
			{/if}
			{#if metadata.statusCurrentActivityTimestamp}
				<div class="timestamp">{formatRelativeTime(metadata.statusCurrentActivityTimestamp)}</div>
			{/if}
		{:else if metadata.summary}
			<div class="summary-only">{metadata.summary}</div>
		{:else}
			<div class="empty-state">
				<Circle class="w-4 h-4 animate-pulse" />
				<span>Waiting for activity...</span>
			</div>
		{/if}
	</div>
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
		gap: 10px;
		padding: 10px 12px;
		border-bottom: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.3);
	}

	:global(.delegation-header .avatar) {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		flex-shrink: 0;
		align-self: flex-start;
		margin-top: 2px;
	}

	.avatar-placeholder {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.7));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: hsl(var(--primary-foreground));
		flex-shrink: 0;
	}

	.header-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.agent-name {
		font-size: 9px;
		color: hsl(var(--muted-foreground));
	}

	.title {
		font-weight: 600;
		font-size: 12px;
		color: hsl(var(--foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.prompt-line {
		font-size: 10px;
		color: hsl(var(--muted-foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.header-right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
		flex-shrink: 0;
	}

	.status-badge {
		font-size: 9px;
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: 600;
		white-space: nowrap;
		border: 1px solid;
	}

	.status-fallback {
		background: hsl(142 76% 36% / 0.2);
		color: hsl(142 76% 46%);
		border-color: hsl(142 76% 36% / 0.3);
	}

	.status-fallback.working {
		background: hsl(45 93% 47% / 0.2);
		color: hsl(45 93% 47%);
		border-color: hsl(45 93% 47% / 0.3);
	}

	.stop-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
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

	.content {
		padding: 10px 12px;
	}

	.activity-main {
		font-size: 11px;
		line-height: 1.4;
		display: flex;
		align-items: flex-start;
		gap: 6px;
	}

	.pulse {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
		margin-top: 5px;
		animation: pulse 2s infinite;
	}

	.activity-text {
		flex: 1;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.summary-muted {
		font-size: 10px;
		color: hsl(var(--muted-foreground));
		margin-top: 6px;
		font-style: italic;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.summary-only {
		font-size: 11px;
		color: hsl(var(--muted-foreground));
		font-style: italic;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.timestamp {
		font-size: 9px;
		color: hsl(var(--muted-foreground) / 0.7);
		margin-top: 4px;
	}

	.empty-state {
		display: flex;
		align-items: center;
		gap: 8px;
		color: hsl(var(--muted-foreground));
		font-size: 11px;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
</style>
