<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { formatRelativeTime } from '$lib/utils/time';
	import { cn } from '$lib/utils/cn';
	import CreateAgentDialog from '../dialogs/CreateAgentDialog.svelte';
	import { Streamdown } from 'svelte-streamdown';

	interface Props {
		event: NDKEvent;
		onclick?: () => void;
	}

	let { event, onclick }: Props = $props();

	// Dropdown state
	let showMenu = $state(false);
	let showRawEventModal = $state(false);
	let showCreateAgentDialog = $state(false);
	let agentData = $state<any>(null);

	const EVENT_KIND_NAMES: Record<number, string> = {
		[NDKKind.Text]: 'Note',
		[NDKKind.AgentLesson]: 'Lesson',
		[NDKKind.Article]: 'Long-form Article'
	};

	function getEventKindName(kind: number | undefined): string {
		if (!kind) return 'Kind unknown';
		return EVENT_KIND_NAMES[kind] || `Kind ${kind}`;
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
		showMenu = false;
	}

	function viewRawEvent(e: MouseEvent) {
		e.stopPropagation();
		showMenu = false;
		showRawEventModal = true;
	}

	function toggleMenu(e: MouseEvent) {
		e.stopPropagation();
		showMenu = !showMenu;
	}

	// Close menu on outside click
	$effect(() => {
		if (!showMenu) return;

		const handleClickOutside = () => {
			showMenu = false;
		};

		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

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

	const kindName = $derived(getEventKindName(event.kind));
	const preview = $derived(getEventPreview(event));
	const timestamp = $derived(event.created_at || 0);
	const eventId = $derived(event.id?.slice(0, 8) || 'unknown');

	// Check if this is a kind:0 event with agent metadata
	const isAgentMetadata = $derived.by(() => {
		if (event.kind !== 0) return false;
		// Check if it has use-criteria, instructions, or description tags
		const hasUseCriteria = event.tags.some(tag => tag[0] === 'use-criteria');
		const hasInstructions = event.tags.some(tag => tag[0] === 'instructions');
		const hasDescription = event.tags.some(tag => tag[0] === 'description');
		return hasUseCriteria || hasInstructions || hasDescription;
	});

	function extractAgentData() {
		if (!isAgentMetadata) return null;

		// Parse content JSON for name, description, and picture
		let contentData: any = {};
		try {
			contentData = JSON.parse(event.content);
		} catch {
			contentData = {};
		}

		// Extract from tags
		const getTagValue = (tagName: string) => {
			const tag = event.tags.find(t => t[0] === tagName);
			return tag?.[1] || '';
		};

		const getTagValues = (tagName: string) => {
			return event.tags.filter(t => t[0] === tagName).map(t => t[1]);
		};

		return {
			name: contentData.name || '',
			description: getTagValue('description') || contentData.description || '',
			picture: contentData.picture || '',
			role: '', // Not in the example, but part of the dialog
			instructions: getTagValue('instructions') || '',
			useCriteria: getTagValues('use-criteria'),
			slug: '', // Could extract from 'a' tag if needed
			tools: [], // Not in this event type
			mcpServers: [],
			phases: []
		};
	}

	function handleCreateAgent(e: MouseEvent) {
		e.stopPropagation();
		agentData = extractAgentData();
		showCreateAgentDialog = true;
	}
</script>

<div
	class={cn(
		'bg-card border border-border rounded-lg transition-colors',
		onclick && 'cursor-pointer hover:bg-muted'
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
					class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded"
				>
					{kindName}
				</span>
				<span class="text-xs text-muted-foreground">
					{formatRelativeTime(timestamp)}
				</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="text-xs font-mono text-muted-foreground">
					{eventId}...
				</span>
				<!-- Dropdown Menu -->
				<div class="relative flex-shrink-0">
					<button
						onclick={toggleMenu}
						class="p-1 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
						type="button"
						aria-label="Open event menu"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
							<path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
						</svg>
					</button>

					{#if showMenu}
						<div
							class="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 py-1"
							onclick={(e) => e.stopPropagation()}
							onkeydown={(e) => e.stopPropagation()}
							role="menu"
							tabindex="-1"
						>
							<!-- View raw event -->
							<button
								onclick={viewRawEvent}
								class="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors text-foreground"
								type="button"
							>
								View raw event
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="px-4 py-3">
		<div class="prose prose-sm max-w-none dark:prose-invert text-muted-foreground line-clamp-3">
			<Streamdown
				content={preview}
				class="prose prose-sm max-w-none dark:prose-invert text-muted-foreground"
				parseIncompleteMarkdown={true}
				animation={{ enabled: false }}
				baseTheme="shadcn"
				shikiTheme="github-dark-dimmed"
			/>
		</div>
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

		<!-- Create Agent Button for kind:0 with agent metadata -->
		{#if isAgentMetadata}
			<div class="mt-3 pt-3 border-t border-border">
				<button
					onclick={handleCreateAgent}
					class="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
					type="button"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Create Agent from this Definition
				</button>
			</div>
		{/if}
	</div>
</div>

<!-- Raw Event Modal -->
{#if showRawEventModal}
	<div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<div
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			onclick={() => showRawEventModal = false}
			onkeydown={(e) => e.key === 'Escape' && (showRawEventModal = false)}
			role="button"
			tabindex="-1"
		></div>
		<div class="relative bg-card border border-border rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
			<div class="flex items-center justify-between px-6 py-4 border-b border-border">
				<h3 class="text-lg font-semibold text-foreground m-0">Raw Event</h3>
				<button onclick={() => showRawEventModal = false} class="p-1 hover:bg-accent rounded transition-colors text-muted-foreground hover:text-foreground" aria-label="Close modal">
					<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="flex-1 overflow-auto px-6 py-4">
				<pre class="text-sm bg-muted p-4 rounded overflow-x-auto text-foreground font-mono">{event.inspect}</pre>
			</div>

			<div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
				<button
					onclick={() => copyToClipboard(event.inspect)}
					class="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors text-sm font-medium"
				>
					Copy to Clipboard
				</button>
				<button
					onclick={() => showRawEventModal = false}
					class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Create Agent Dialog -->
<CreateAgentDialog bind:open={showCreateAgentDialog} forkAgent={agentData} cloneMode={true} />
