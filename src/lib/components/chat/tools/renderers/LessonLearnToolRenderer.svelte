<script lang="ts">
	import { BookOpen, Tag, FileText } from 'lucide-svelte';

	interface LessonLearnArgs {
		title?: string;
		lesson?: string;
		detailed?: string;
		category?: string;
		hashtags?: string[];
	}

	interface Props {
		args: LessonLearnArgs | null;
	}

	let { args }: Props = $props();

	const title = $derived(args?.title || 'Untitled Lesson');
	const lesson = $derived(args?.lesson || '');
	const detailed = $derived(args?.detailed || '');
	const category = $derived(args?.category || '');
	const hashtags = $derived(args?.hashtags || []);
</script>

<div class="flex flex-col gap-2 text-sm">
	<!-- Header with icon -->
	<div class="flex items-center gap-2 text-primary">
		<BookOpen class="w-4 h-4 flex-shrink-0" />
		<span class="font-medium">Learning lesson: {title}</span>
	</div>

	<!-- Lesson Content -->
	{#if lesson}
		<div class="pl-6 space-y-2">
			<div class="bg-muted/50 border border-border rounded-md p-3">
				<div class="flex items-start gap-2">
					<FileText class="w-4 h-4 flex-shrink-0 text-primary mt-0.5" />
					<div class="flex-1 space-y-2">
						<p class="text-sm text-foreground">{lesson}</p>

						<!-- Category badge -->
						{#if category}
							<span class="inline-flex px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded">
								{category}
							</span>
						{/if}

						<!-- Hashtags -->
						{#if hashtags.length > 0}
							<div class="flex flex-wrap gap-1.5 items-center">
								<Tag class="w-3 h-3 text-muted-foreground" />
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

		</div>
	{/if}
</div>
