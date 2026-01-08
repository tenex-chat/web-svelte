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
	// This tag is set on the root event of a delegated conversation, pointing to the parent
	const delegationTag = $derived(rootEvent.tags.find(t => t[0] === 'delegation'));
	const delegationParentEventId = $derived(delegationTag?.[1]);

	// Parent conversation root event
	let parentConversationRoot = $state<NDKEvent | null>(null);

	// Effect to find parent conversation
	// Strategy 1: Use the delegation tag if present (points directly to parent conversation root)
	// Strategy 2: Search for events with q-tag pointing to this conversation (reverse lookup)
	$effect(() => {
		const conversationId = rootEvent.id;

		// Reset state
		parentConversationRoot = null;

		async function findParentConversation() {
			try {
				// Strategy 1: If we have a delegation tag, fetch that event directly
				if (delegationParentEventId) {
					const parentEvent = await ndk.fetchEvent(delegationParentEventId);
					if (parentEvent) {
						// The delegation tag points to the parent conversation's root event
						parentConversationRoot = parentEvent;
						return;
					}
				}

				// Strategy 2: Search for events that have a q-tag pointing to this conversation
				// These are the delegation tool call events in the parent conversation
				const delegatingEvents = await ndk.fetchEvents({
					kinds: [1],
					'#q': [conversationId]
				});

				if (delegatingEvents.size > 0) {
					// Get the first delegating event (the one that created this delegation)
					const delegatingEvent = Array.from(delegatingEvents)[0];

					// Now find the root of the parent conversation
					// The delegating event should have an e-tag pointing to its conversation root
					const rootTag = delegatingEvent.tags.find(t => t[0] === 'e' && t[3] === 'root');
					const parentRootId = rootTag?.[1];

					if (parentRootId) {
						const parentRoot = await ndk.fetchEvent(parentRootId);
						if (parentRoot) {
							parentConversationRoot = parentRoot;
							return;
						}
					}

					// Fallback: if no root tag, try to find an event with no e-tags in this thread
					// by looking for events that are roots (have no e-tags)
					const aTag = delegatingEvent.tagValue('a');
					if (aTag) {
						// Search for root events in the same project
						const projectRoots = await ndk.fetchEvents({
							kinds: [1],
							'#a': [aTag],
							limit: 50
						});

						// Find an event that has no e-tag (is a root) and has q-tags that include us
						for (const event of projectRoots) {
							const eTags = event.tags.filter(t => t[0] === 'e');

							// Check if this is a root conversation that delegated to us
							if (eTags.length === 0) {
								// This is a root - now check if any event in this conversation delegated to us
								// For simplicity, use the delegating event's conversation
								const delegatingEventETags = delegatingEvent.tags.filter(t => t[0] === 'e');
								if (delegatingEventETags.length === 0) {
									// The delegating event itself is a root
									parentConversationRoot = delegatingEvent;
									return;
								}
							}
						}
					}
				}
			} catch (error) {
				console.error('Error finding parent conversation:', error);
			}
		}

		findParentConversation();
	});

	// Get metadata for parent conversation from centralized store
	const parentMetadata = $derived(
		parentConversationRoot ? conversationMetadataStore.getConversationData(parentConversationRoot.id) : null
	);

	// Derive parent title with fallback
	const parentTitle = $derived(
		parentMetadata?.title || parentConversationRoot?.tagValue('title') || 'Parent Conversation'
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
		if (!parentConversationRoot) {
			console.warn('No parent event to navigate to');
			return;
		}

		const aTag = parentConversationRoot.tags?.find(t => t[0] === 'a')?.[1];
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
				windowManager.replaceDetachedWindow(windowContext.windowId, project, parentConversationRoot);
			} else {
				// In drawer or no context - push onto drawer stack
				windowManager.openChat(project, parentConversationRoot);
			}
		} else {
			console.warn('Could not determine project for parent conversation');
		}
	}
</script>

{#if parentConversationRoot}
	<div class="parent-link-container">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<span class="parent-link" onclick={handleClick}>
			<ArrowUpRight class="w-3 h-3" />
			<span>Go to Parent: {parentTitle}</span>
		</span>
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
</style>
