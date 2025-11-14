<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
	import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { BookOpen } from 'lucide-svelte';
	import LessonCard from './LessonCard.svelte';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	// Subscribe to kind 4129 (NDKAgentLesson) events
	const lessonsSubscription = ndk.$subscribe(() => ({
		filters: [
			{
				kinds: [4129 as NDKKind],
				authors: [pubkey],
				limit: 50
			}
		],
		closeOnEose: false
	}));

	const lessons = $derived.by(() => {
		const events = lessonsSubscription.events || [];
		return events.map(event => NDKAgentLesson.from(event));
	});
</script>

<div class="space-y-4">
	{#if lessons.length === 0}
		<div class="flex flex-col items-center justify-center h-64 text-center">
			<BookOpen class="w-12 h-12 text-muted-foreground mb-2" />
			<h3 class="text-lg font-medium text-foreground">No lessons yet</h3>
			<p class="text-sm text-muted-foreground">
				This agent hasn't learned any lessons yet.
			</p>
		</div>
	{:else}
		{#each lessons as lesson (lesson.id)}
			<LessonCard {lesson} />
		{/each}
	{/if}
</div>
