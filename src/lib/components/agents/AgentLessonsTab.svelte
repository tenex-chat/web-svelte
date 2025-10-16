<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '@nostr-dev-kit/ndk';
	import { BookOpen } from 'lucide-svelte';

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

	const lessons = $derived(lessonsSubscription.events || []);
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
			<div
				class="bg-card border border-border rounded-lg p-4 hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer"
			>
				<h3 class="font-semibold text-foreground mb-2">
					{lesson.tagValue('title') || 'Untitled Lesson'}
				</h3>
				<p class="text-sm text-muted-foreground line-clamp-3">
					{lesson.content}
				</p>
				<div class="mt-2 flex items-center gap-2">
					<span class="text-xs text-muted-foreground">
						{new Date((lesson.created_at || 0) * 1000).toLocaleDateString()}
					</span>
				</div>
			</div>
		{/each}
	{/if}
</div>
