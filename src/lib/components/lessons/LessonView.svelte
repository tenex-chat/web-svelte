<script lang="ts">
	import type { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { Clock, Hash, ArrowLeft, Copy, Check, BookOpen, Brain, Lightbulb, MessageCircle } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { extractLessonMetadata, calculateReadingTime, combineTextSections } from '$lib/types/lesson';
	import LessonComments from './LessonComments.svelte';
	import LessonContentSection from './LessonContentSection.svelte';

	interface Props {
		lesson: NDKAgentLesson;
		onBack?: () => void;
	}

	let { lesson, onBack }: Props = $props();

	// Extract typed metadata from the lesson
	const lessonMetadata = $derived(extractLessonMetadata(lesson));

	// Calculate reading time from all content sections
	const readingTime = $derived(
		calculateReadingTime(
			combineTextSections(
				lessonMetadata.content,
				lessonMetadata.detailed,
				lessonMetadata.reasoning,
				lessonMetadata.metacognition,
				lessonMetadata.reflection
			)
		)
	);

	// Copy link functionality
	let isCopied = $state(false);

	async function handleCopyLink(): Promise<void> {
		try {
			const encoded = lesson.encode();
			await navigator.clipboard.writeText(encoded);
			isCopied = true;
			setTimeout(() => (isCopied = false), 2000);
		} catch (error) {
			console.error('Failed to copy link:', error);
		}
	}
</script>

<div class="h-full flex flex-col bg-card">
	<!-- Header -->
	<header class="border-b border-border px-4 py-3">
		<div class="flex items-center gap-3">
			{#if onBack}
				<button
					type="button"
					onclick={onBack}
					class="p-1.5 rounded hover:bg-muted transition-colors"
					aria-label="Go back"
				>
					<ArrowLeft class="h-4 w-4" />
				</button>
			{/if}
			<div class="flex-1 min-w-0">
				<h1 class="text-lg font-semibold truncate">{lessonMetadata.title}</h1>
				<div class="flex items-center gap-2 mt-0.5 flex-wrap">
					{#if lessonMetadata.category}
						<span class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded dark:bg-blue-900 dark:text-blue-200">
							{lessonMetadata.category}
						</span>
					{/if}
					{#if lessonMetadata.detailed}
						<span class="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs font-medium rounded dark:bg-purple-900 dark:text-purple-200">
							Detailed
						</span>
					{/if}
				</div>
			</div>
			<button
				type="button"
				onclick={handleCopyLink}
				class="p-1.5 rounded hover:bg-muted transition-colors"
				aria-label={isCopied ? 'Link copied' : 'Copy link'}
			>
				{#if isCopied}
					<Check class="h-4 w-4 text-green-500" />
				{:else}
					<Copy class="h-4 w-4" />
				{/if}
			</button>
		</div>
	</header>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto">
		<article class="max-w-3xl mx-auto px-6 py-6">
			<!-- Author & Metadata Section -->
			<section class="mb-6 pb-6 border-b border-border">
				<User.Root {ndk} pubkey={lessonMetadata.pubkey}>
					<div class="flex items-center gap-3 mb-3">
						<User.Avatar class="w-10 h-10" />
						<div>
							<div class="font-medium text-sm"><User.Name /></div>
							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								<Clock class="h-3 w-3" />
								<time datetime={new Date(lessonMetadata.createdAt * 1000).toISOString()}>
									{formatRelativeTime(lessonMetadata.createdAt)}
								</time>
								<span aria-hidden="true">·</span>
								<span>{readingTime}</span>
							</div>
						</div>
					</div>
				</User.Root>

				<!-- Hashtags -->
				{#if lessonMetadata.hashtags.length > 0}
					<div class="flex items-center gap-2 flex-wrap" role="list" aria-label="Tags">
						{#each lessonMetadata.hashtags as tag (tag)}
							<div
								class="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted text-foreground rounded"
								role="listitem"
							>
								<Hash class="h-3 w-3" aria-hidden="true" />
								<span>{tag}</span>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Lesson Content Sections -->
			<div class="space-y-6">
				<LessonContentSection
					title="Lesson"
					content={lessonMetadata.content}
					icon={BookOpen}
					iconColor="text-blue-500"
				/>

				{#if lessonMetadata.detailed}
					<LessonContentSection
						title="Detailed Explanation"
						content={lessonMetadata.detailed}
						icon={Lightbulb}
						iconColor="text-amber-500"
					/>
				{/if}

				{#if lessonMetadata.reasoning}
					<LessonContentSection
						title="Reasoning"
						content={lessonMetadata.reasoning}
						icon={Brain}
						iconColor="text-green-500"
					/>
				{/if}

				{#if lessonMetadata.metacognition}
					<LessonContentSection
						title="Metacognition"
						content={lessonMetadata.metacognition}
						icon={MessageCircle}
						iconColor="text-purple-500"
					/>
				{/if}

				{#if lessonMetadata.reflection}
					<LessonContentSection
						title="Reflection"
						content={lessonMetadata.reflection}
						iconColor="text-teal-500"
					>
						{#snippet iconSlot()}
							<svg class="h-5 w-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						{/snippet}
					</LessonContentSection>
				{/if}
			</div>

			<!-- Comments Section -->
			<section class="mt-8 pt-6 border-t border-border">
				<LessonComments {lesson} />
			</section>
		</article>
	</div>
</div>
