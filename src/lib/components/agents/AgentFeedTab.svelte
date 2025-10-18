<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
	import { Activity } from 'lucide-svelte';
	import Message from '../chat/Message.svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import VirtualList from '@humanspeak/svelte-virtual-list';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	// Subscribe to all events from this agent
	const feedSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				authors: [pubkey],
				limit: 50
			}
		],
		closeOnEose: false
	}));

	const EVENT_KIND_NAMES: Record<number, string> = {
		1: 'Note',
		4128: 'Agent Definition',
		4129: 'Lesson',
		9905: 'Job Request',
		9906: 'Job Accepted',
		9907: 'Job Status',
		9908: 'Job Feedback',
		30078: 'Application Specific Data',
		1111: 'Generic Reply',
		30023: 'Long-form Article'
	};

	// Filter and sort events
	const sortedEvents = $derived.by(() => {
		if (!feedSubscription.events) return [];

		return [...feedSubscription.events]
			.filter((event) => {
				const kind = event.kind as number;
				// Filter out ephemeral events (20000-29999)
				if (kind >= 20000 && kind <= 29999) return false;
				// Filter out operations status and stop request events
				if (kind === 24133 || kind === 24134) return false;
				return true;
			})
			.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});

	function getEventKindName(kind: NDKKind | undefined): string {
		if (!kind) return 'Unknown';
		return EVENT_KIND_NAMES[kind as number] || `Kind ${kind}`;
	}

	function getEventPreview(event: NDKEvent): string {
		try {
			const content = event.content;
			if (!content) return 'No content';

			// Try to parse as JSON
			try {
				const parsed = JSON.parse(content);
				if (parsed.content) return parsed.content;
				if (parsed.text) return parsed.text;
				if (parsed.message) return parsed.message;
				if (parsed.description) return parsed.description;
				if (parsed.title) return parsed.title;
				if (parsed.name) return parsed.name;
				// Return first string value found
				for (const value of Object.values(parsed)) {
					if (typeof value === 'string' && value.trim()) {
						return value;
					}
				}
			} catch {
				// Not JSON, return as is
			}

			return content;
		} catch {
			return 'Unable to parse content';
		}
	}
</script>

<div class="h-full flex flex-col overflow-hidden">
	{#if sortedEvents.length === 0}
		<div class="flex flex-col items-center justify-center h-64 text-center">
			<Activity class="w-12 h-12 text-muted-foreground mb-2" />
			<h3 class="text-lg font-medium text-foreground">No events yet</h3>
			<p class="text-sm text-muted-foreground">This agent hasn't published any events.</p>
		</div>
	{:else}
		<div class="flex-1 overflow-auto">
			<VirtualList items={sortedEvents} height="100%" itemHeight={150}>
				{#snippet slot({ item: event })}
					{@const kind = event.kind as number}

					<div class="px-3 py-1.5">
						{#if kind === 1111}
							<!-- Use Message component for Generic Reply -->
							<Message message={{ id: event.id, event }} />
						{:else}
							<!-- Default card rendering for other events -->
							<div
								class="bg-card border border-border rounded-lg hover:bg-muted dark:hover:bg-zinc-800 transition-colors cursor-pointer"
							>
								<div class="px-4 py-3 border-b border-border">
									<div class="flex items-start justify-between">
										<div class="flex items-center gap-2">
											<span
												class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded"
											>
												{getEventKindName(event.kind)}
											</span>
											<span class="text-xs text-muted-foreground">
												{formatRelativeTime(event.created_at || 0)}
											</span>
										</div>
										<span class="text-xs font-mono text-muted-foreground">
											{event.id?.slice(0, 8)}...
										</span>
									</div>
								</div>
								<div class="px-4 py-3">
									<p class="text-sm text-muted-foreground line-clamp-3">
										{getEventPreview(event)}
									</p>
									{#if event.tags.length > 0}
										<div class="mt-2 flex flex-wrap gap-1">
											{#each event.tags.slice(0, 5) as tag, idx (idx)}
												<span
													class="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded"
												>
													{tag[0]}{tag[1] ? `: ${tag[1].slice(0, 20)}${tag[1].length > 20 ? '...' : ''}` : ''}
												</span>
											{/each}
											{#if event.tags.length > 5}
												<span class="text-xs text-muted-foreground">
													+{event.tags.length - 5} more
												</span>
											{/if}
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/snippet}
			</VirtualList>
		</div>
	{/if}
</div>
