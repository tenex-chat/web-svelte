<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { formatRelativeTime } from '$lib/utils/time';
	import { cn } from '$lib/utils/cn';

	interface Props {
		event: NDKEvent;
		onclick?: () => void;
	}

	let { event, onclick }: Props = $props();

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

	function getEventKindName(kind: number | undefined): string {
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

	const kindName = $derived(getEventKindName(event.kind as number));
	const preview = $derived(getEventPreview(event));
	const timestamp = $derived(event.created_at || 0);
	const eventId = $derived(event.id?.slice(0, 8) || 'unknown');
</script>

<div
	class={cn(
		'bg-card border border-border rounded-lg transition-colors',
		onclick && 'cursor-pointer hover:bg-muted dark:hover:bg-zinc-800'
	)}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	onclick={onclick}
	onkeydown={(e) => {
		if (onclick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			onclick();
		}
	}}
>
	<!-- Header -->
	<div class="px-4 py-3 border-b border-border">
		<div class="flex items-start justify-between">
			<div class="flex items-center gap-2">
				<span
					class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded"
				>
					{kindName}
				</span>
				<span class="text-xs text-muted-foreground">
					{formatRelativeTime(timestamp)}
				</span>
			</div>
			<span class="text-xs font-mono text-muted-foreground">
				{eventId}...
			</span>
		</div>
	</div>

	<!-- Content -->
	<div class="px-4 py-3">
		<p class="text-sm text-muted-foreground line-clamp-3">
			{preview}
		</p>
		{#if event.tags.length > 0}
			<div class="mt-2 flex flex-wrap gap-1">
				{#each event.tags.slice(0, 5) as tag, idx (idx)}
					<span class="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
						{tag[0]}{tag[1]
							? `: ${tag[1].slice(0, 20)}${tag[1].length > 20 ? '...' : ''}`
							: ''}
					</span>
				{/each}
				{#if event.tags.length > 5}
					<span class="text-xs text-muted-foreground"> +{event.tags.length - 5} more </span>
				{/if}
			</div>
		{/if}
	</div>
</div>
