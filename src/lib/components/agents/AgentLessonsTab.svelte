<script lang="ts">
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { BookOpen } from 'lucide-svelte';
	import { LoadingState, EmptyState } from '$lib/components/ui';
	import LessonCard from './LessonCard.svelte';
	import {
		createLessonSubscriptionOptions,
		transformToLessons,
		DEFAULT_LESSON_LIMIT
	} from '$lib/services/lessonService';

	interface Props {
		/** The pubkey of the agent to display lessons for */
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	// Pagination state
	const LESSONS_PER_PAGE = 20;
	let displayedLessonCount = $state(DEFAULT_LESSON_LIMIT);

	// Subscribe to lessons for this agent using the service
	const lessonsSubscription = ndk.$subscribe(() =>
		createLessonSubscriptionOptions({
			authors: [pubkey],
			limit: displayedLessonCount
		})
	);

	// Subscription state tracking
	const isLoadingLessons = $derived(!lessonsSubscription.eosed);

	// Transform raw events to typed lessons, sorted by newest first
	const agentLessons = $derived.by(() => {
		const rawEvents = lessonsSubscription.events || [];
		const lessons = transformToLessons(rawEvents);
		return lessons.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
	});

	// Pagination helpers
	const hasMoreLessons = $derived(agentLessons.length >= displayedLessonCount);

	function loadMoreLessons(): void {
		displayedLessonCount += LESSONS_PER_PAGE;
	}

	function handleLessonClick(lesson: NDKAgentLesson): void {
		const encoded = lesson.encode();
		goto(`/lessons/${encoded}`);
	}
</script>

<div class="space-y-4">
	{#if isLoadingLessons && agentLessons.length === 0}
		<LoadingState message="Loading lessons..." />
	{:else if agentLessons.length === 0}
		<EmptyState
			icon={BookOpen}
			title="No lessons yet"
			description="This agent hasn't learned any lessons yet."
		/>
	{:else}
		{#each agentLessons as lesson (lesson.id)}
			<LessonCard {lesson} onclick={() => handleLessonClick(lesson)} />
		{/each}

		<!-- Load More Button -->
		{#if hasMoreLessons}
			<div class="text-center pt-4">
				<button
					type="button"
					onclick={loadMoreLessons}
					class="text-sm text-primary hover:text-primary/80 transition-colors"
				>
					Load more lessons
				</button>
			</div>
		{/if}
	{/if}
</div>
