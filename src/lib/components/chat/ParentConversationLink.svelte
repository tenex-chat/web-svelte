<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { getContext } from 'svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import { conversationMetadataStore } from '$lib/stores/conversationMetadata.svelte';
	import { openProjects } from '$lib/stores/openProjects.svelte';
	import { WINDOW_CONTEXT_KEY } from './ChatView.svelte';
	import { ArrowUpRight } from 'lucide-svelte';

	// Get window context to determine if we're in a drawer or detached window
	const windowContext = getContext<{ windowId?: string; isDetached: boolean } | undefined>(WINDOW_CONTEXT_KEY);

	interface Props {
		rootEvent: NDKEvent;
	}

	let { rootEvent }: Props = $props();

	// Extract delegation tag - format: ["delegation", "event-id"]
	const delegationTag = $derived(rootEvent.tags.find(t => t[0] === 'delegation'));
	const parentEventId = $derived(delegationTag?.[1]);

	// Fetch parent event when we have a delegation tag
	let parentEvent = $state<NDKEvent | null>(null);
	let isLoading = $state(false);

	$effect(() => {
		if (!parentEventId) {
			parentEvent = null;
			return;
		}

		isLoading = true;
		ndk.fetchEvent(parentEventId).then((event) => {
			parentEvent = event ?? null;
			isLoading = false;
		}).catch(() => {
			parentEvent = null;
			isLoading = false;
		});
	});

	// Get metadata for parent conversation from centralized store
	const parentMetadata = $derived(
		parentEventId ? conversationMetadataStore.getConversationData(parentEventId) : null
	);

	// Derive parent title with fallback
	const parentTitle = $derived(
		parentMetadata?.title || parentEvent?.tagValue('title') || 'Parent Conversation'
	);

	/**
	 * Find project from local store first, avoiding network fetch
	 * Falls back to network fetch only if not found locally
	 */
	function findProject(aTag: string): NDKProject | null {
		const [kindStr, pubkey, dTag] = aTag.split(':');
		if (!kindStr || !pubkey || !dTag) return null;

		// First try to find in openProjects (already loaded)
		const localProject = openProjects.projects.find(p =>
			p.dTag === dTag && p.pubkey === pubkey
		);
		if (localProject) {
			return localProject;
		}

		return null;
	}

	/**
	 * Async fallback to fetch project from network if not found locally
	 */
	async function fetchProject(aTag: string): Promise<NDKProject | null> {
		const [kindStr, pubkey, dTag] = aTag.split(':');
		if (!kindStr || !pubkey || !dTag) return null;

		const projectEvent = await ndk.fetchEvent({
			kinds: [parseInt(kindStr)],
			authors: [pubkey],
			'#d': [dTag]
		});
		if (projectEvent) {
			return NDKProject.from(projectEvent);
		}
		return null;
	}

	// Navigate to parent conversation
	async function handleClick() {
		if (!parentEvent) {
			console.warn('No parent event to navigate to');
			return;
		}

		const aTag = parentEvent.tags?.find(t => t[0] === 'a')?.[1];
		if (!aTag) {
			console.warn('Could not determine project for parent conversation: no a-tag');
			return;
		}

		// Try local lookup first (instant), fall back to network fetch
		let project = findProject(aTag);
		if (!project) {
			project = await fetchProject(aTag);
		}

		if (project) {
			// Check if we're in a detached window - if so, replace the window content
			if (windowContext?.isDetached && windowContext.windowId) {
				windowManager.replaceDetachedWindow(windowContext.windowId, project, parentEvent);
			} else {
				// In drawer or no context - push onto drawer stack
				windowManager.openChat(project, parentEvent);
			}
		} else {
			console.warn('Could not determine project for parent conversation');
		}
	}
</script>

{#if parentEventId}
	<div class="parent-link-container">
		{#if isLoading}
			<span class="loading-text">Loading parent...</span>
		{:else if parentEvent}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span class="parent-link" onclick={handleClick}>
				<ArrowUpRight class="w-3 h-3" />
				<span>Go to Parent: {parentTitle}</span>
			</span>
		{/if}
	</div>
{/if}

<style>
	.parent-link-container {
		margin-bottom: 4px;
	}

	.parent-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: hsl(var(--primary));
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.parent-link:hover {
		color: hsl(var(--primary) / 0.8);
		text-decoration: underline;
	}

	.loading-text {
		font-size: 12px;
		color: hsl(var(--muted-foreground));
		font-style: italic;
	}
</style>
