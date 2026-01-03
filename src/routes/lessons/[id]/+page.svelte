<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { createFetchEvent } from '@nostr-dev-kit/svelte';
	import LessonView from '$lib/components/lessons/LessonView.svelte';
	import { ErrorState } from '$lib/components/ui';
	import { BookOpen } from 'lucide-svelte';

	const lessonId = $derived($page.params.id);

	const lessonEventFetcher = createFetchEvent(ndk, () => ({ bech32: lessonId }));

	// Transform the raw event to a lesson when available
	const fetchedLesson = $derived.by(() => {
		if (!lessonEventFetcher.event) return null;
		return NDKAgentLesson.from(lessonEventFetcher.event);
	});

	// Timeout to show "not found" if event doesn't arrive
	let hasTimedOut = $state(false);
	$effect(() => {
		hasTimedOut = false;
		const timer = setTimeout(() => {
			hasTimedOut = true;
		}, 5000);
		return () => clearTimeout(timer);
	});

	function handleBack(): void {
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
	{:else if hasTimedOut}
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
