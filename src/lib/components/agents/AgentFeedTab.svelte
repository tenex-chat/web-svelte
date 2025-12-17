<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { Activity } from 'lucide-svelte';
	import Message from '../chat/Message.svelte';
	import LessonCard from './LessonCard.svelte';
	import GenericEventCard from '../events/GenericEventCard.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	$effect(() => {
		console.log('[AgentFeedTab] Subscribing to agent:', pubkey);
	});

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

	// Debug: log subscription state
	$effect(() => {
		console.log('[AgentFeedTab] Subscription events changed:', feedSubscription.events?.length || 0);
	});

	// Filter and sort events
	const sortedEvents = $derived.by(() => {
		if (!feedSubscription.events) {
			console.log('[AgentFeedTab] No events from subscription');
			return [];
		}

		console.log('[AgentFeedTab] Raw events:', feedSubscription.events.length);

		const filtered = [...feedSubscription.events]
			.filter((event) => {
				const kind = event.kind;
				// Filter out ephemeral events (20000-29999)
				if (kind >= 20000 && kind <= 29999) return false;
				// Filter out operations status and stop request events
				if (kind === 24133 || kind === 24134) return false;
				return true;
			});

		console.log('[AgentFeedTab] Filtered events:', filtered.length, 'kinds:', filtered.map(e => e.kind));

		return filtered.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});
</script>

<div class="h-full flex flex-col overflow-hidden">
	{#if sortedEvents.length === 0}
		<div class="flex flex-col items-center justify-center h-64 text-center">
			<Activity class="w-12 h-12 text-muted-foreground mb-2" />
			<h3 class="text-lg font-medium text-foreground">No events yet</h3>
			<p class="text-sm text-muted-foreground">This agent hasn't published any events.</p>
		</div>
	{:else}
		<div class="p-4">
			<p class="text-sm text-muted-foreground mb-2">Showing {sortedEvents.length} events</p>
		</div>
		<div class="flex-1 overflow-auto space-y-2 px-4">
			{#each sortedEvents.slice(0, 10) as event (event.id)}
				{@const kind = event.kind}

				<!-- Debug: log each render attempt -->
				{console.log('[AgentFeedTab] Rendering event:', event.id, 'kind:', kind)}

				<!--
					Event Type Rendering
					Add new event type handlers here for specialized rendering.
					Format: {#if kind === NDKKind.YourKind}
				-->

				{#if kind === 1111}
					<!-- Generic Reply (kind 1111) - Chat message -->
					<Message message={{ id: event.id, event }} />
				{:else if kind === 4129}
					<!-- Agent Lesson (kind 4129) - Learning events -->
					{@const lesson = NDKAgentLesson.from(event)}
					<LessonCard {lesson} compact={true} />
				{:else if kind === 30023}
					<!-- Long-form Article (kind 30023) - Future: ArticleEmbedCard -->
					<!-- TODO: Add ArticleEmbedCard component when implemented -->
					<GenericEventCard {event} />
				{:else}
					<!-- Generic fallback for unhandled event types -->
					<GenericEventCard {event} />
				{/if}
			{/each}
		</div>
	{/if}
</div>
