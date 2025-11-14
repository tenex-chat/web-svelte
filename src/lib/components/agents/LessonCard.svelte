<script lang="ts">
	import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { formatRelativeTime } from '$lib/utils/time';
	import { cn } from '$lib/utils/cn';

	interface Props {
		lesson: NDKAgentLesson;
		compact?: boolean;
		onclick?: () => void;
	}

	let { lesson, compact = false, onclick }: Props = $props();

	const title = $derived(lesson.title || 'Untitled Lesson');
	const category = $derived(lesson.category);
	const detailed = $derived(!!lesson.detailed);
	const hashtags = $derived(lesson.hashtags || []);
	const content = $derived(lesson.lesson);
	const reasoning = $derived(lesson.reasoning);
	const metacognition = $derived(lesson.metacognition);
	const reflection = $derived(lesson.reflection);
	const timestamp = $derived(lesson.created_at || 0);
</script>

<div
	class={cn(
		'bg-card border border-border rounded-lg transition-colors',
		onclick && 'cursor-pointer hover:border-blue-500 dark:hover:border-blue-400'
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
			<div class="flex-1">
				<h3 class="font-semibold text-foreground text-base">
					{title}
				</h3>
				<div class="flex items-center gap-2 mt-1 flex-wrap">
					<span class="text-xs text-muted-foreground">
						{formatRelativeTime(timestamp)}
					</span>
					{#if category}
						<span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded">
							{category}
						</span>
					{/if}
					{#if detailed}
						<span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium rounded">
							Detailed
						</span>
					{/if}
				</div>
				{#if hashtags.length > 0}
					<div class="flex flex-wrap gap-1 mt-2">
						{#each hashtags as tag (tag)}
							<span class="text-xs text-muted-foreground">
								#{tag}
							</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	{#if !compact}
		<div class="px-4 py-3 space-y-4">
			<!-- Lesson Content -->
			<div>
				<h4 class="font-medium text-sm text-foreground mb-2">
					Lesson
					{#if detailed}
						<span class="text-xs font-normal text-muted-foreground">
							(summary)
						</span>
					{/if}
				</h4>
				<p class="text-sm text-muted-foreground line-clamp-3">
					{content}
				</p>
			</div>

			<!-- Reasoning -->
			{#if reasoning}
				<div>
					<h4 class="font-medium text-sm text-foreground mb-2">Reasoning</h4>
					<p class="text-sm text-muted-foreground line-clamp-2">
						{reasoning}
					</p>
				</div>
			{/if}

			<!-- Metacognition -->
			{#if metacognition}
				<div>
					<h4 class="font-medium text-sm text-foreground mb-2">Metacognition</h4>
					<p class="text-sm text-muted-foreground line-clamp-2">
						{metacognition}
					</p>
				</div>
			{/if}

			<!-- Reflection -->
			{#if reflection}
				<div>
					<h4 class="font-medium text-sm text-foreground mb-2">Reflection</h4>
					<p class="text-sm text-muted-foreground line-clamp-2">
						{reflection}
					</p>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Compact mode - just show content preview -->
		<div class="px-4 py-3">
			<p class="text-sm text-muted-foreground line-clamp-3">
				{content}
			</p>
		</div>
	{/if}
</div>
