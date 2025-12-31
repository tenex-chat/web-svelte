<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { createFetchEvent } from '@nostr-dev-kit/svelte';
	import LessonView from '$lib/components/lessons/LessonView.svelte';
	import { LoadingState, ErrorState } from '$lib/components/ui';
	import { BookOpen } from 'lucide-svelte';

	const lessonId = $derived($page.params.id);

	const lessonEventFetcher = createFetchEvent(ndk, () => ({ bech32: lessonId }));

	// Transform the raw event to a lesson when available
	const fetchedLesson = $derived.by(() => {
		if (!lessonEventFetcher.event) return null;
		return NDKAgentLesson.from(lessonEventFetcher.event);
	});

	// Track loading state with a timeout for better UX
	// The fetcher doesn't expose eose/eosed, so we use a simple approach
	let hasTimedOut = $state(false);
	$effect(() => {
		hasTimedOut = false;
		const timer = setTimeout(() => {
			hasTimedOut = true;
		}, 5000); // 5 second timeout for "not found" state
		return () => clearTimeout(timer);
	});

	// We're loading if there's no event yet and we haven't timed out
	const isLoading = $derived(!fetchedLesson && !hasTimedOut);

	function handleBack(): void {
		// Try to go back, or navigate to home
		if (window.history.length > 1) {
			window.history.back();
		} else {
			goto('/');
		}
	}
</script>

<div class="flex-1 flex flex-col h-full">
	{#if fetchedLesson}
		<LessonView lesson={fetchedLesson} onBack={handleBack} />
	{:else if isLoading}
		<div class="flex-1 flex items-center justify-center bg-background">
			<LoadingState message="Loading lesson..." />
		</div>
	{:else}
		<div class="flex-1 flex items-center justify-center bg-background">
			<ErrorState title="Lesson not found" message="This lesson could not be found or may have been deleted.">
				{#snippet icon()}
					<BookOpen class="w-12 h-12 text-muted-foreground mb-4" />
				{/snippet}
				{#snippet action()}
					<button
						onclick={handleBack}
						class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
					>
						Go Back
					</button>
				{/snippet}
			</ErrorState>
		</div>
	{/if}
</div>
