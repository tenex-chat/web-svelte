<script lang="ts">
	import { NDKEvent, NDKProject } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';
    import ndk from '$lib/ndk.svelte';

	interface Props {
		event: NDKEvent;
		class?: string;
		isMobile?: boolean;
	}

	let { event, class: className, isMobile = false }: Props = $props();

	// Extract suggestion tags from the event
	const suggestions = $derived(
		event.tags
			?.filter((tag) => tag[0] === 'suggestion')
			?.map((tag) => tag[1])
			?.filter(Boolean) || []
	);

	async function handleSuggestionClick(suggestion: string) {
		if (!ndk.$currentUser) {
			alert("Unable to send response. Please ensure you are logged in.");
			return;
		}

		try {
			// Create a kind:1 reply with the selected suggestion as content
			const replyEvent = new NDKEvent(ndk);
			replyEvent.kind = 1;
			replyEvent.content = suggestion;

			// Find the root event ID - it's either in the e-tag of the parent, or the parent is the root
			const rootId = event.tags.find(t => t[0] === 'e')?.[1] || event.id;
			replyEvent.tags = [["e", rootId]]; // Always e-tag the root

			// Add p-tag for the author of the original event
			replyEvent.tags.push(["p", event.pubkey]);

			// If this is in a project context, add the project tag
			const projectTag = event.tags.find(
				(tag) =>
					tag[0] === "a" && tag[1]?.startsWith(NDKProject.kind.toString()),
			);
			if (projectTag) {
				replyEvent.tags.push(projectTag);
			}

			// Sign and publish the event
			await replyEvent.sign();
			replyEvent.publish();

			console.log("Suggestion response sent:", suggestion);
		} catch (error) {
			console.error("Failed to send suggestion response:", error);
			alert("Failed to send response. Please try again.");
		}
	}
</script>

{#if suggestions.length > 0}
	<div
		class={cn(
			'flex flex-wrap gap-2',
			isMobile && 'gap-1.5 p-2',
			className
		)}
	>
		<div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 w-full">
			<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
				/>
			</svg>
			<span>Suggested responses:</span>
		</div>
		{#each suggestions as suggestion, index (`${event.id}-suggestion-${index}`)}
			<button
				type="button"
				onclick={() => handleSuggestionClick(suggestion)}
				class={cn(
					'group relative transition-all hover:border-muted-foreground text-sm',
					'flex items-center gap-2 px-3 py-2 border border-border rounded-md',
					isMobile && 'text-xs px-2.5 py-1.5'
				)}
			>
				<span class="flex-1 text-left">{suggestion}</span>
				<svg
					class="h-3 w-3 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M14 5l7 7m0 0l-7 7m7-7H3"
					/>
				</svg>
			</button>
		{/each}
	</div>
{/if}
