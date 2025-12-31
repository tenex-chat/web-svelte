<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
	import { User } from '$lib/ndk/ui/user';
	import { formatRelativeTime } from '$lib/utils/time';
	import { MessageCircle, Send } from 'lucide-svelte';
	import { Spinner } from '$lib/components/ui';
	import {
		createCommentSubscriptionOptions,
		transformToComments,
		createCommentEvent,
		publishComment,
		DEFAULT_COMMENT_LIMIT
	} from '$lib/services/lessonService';
	import type { LessonComment } from '$lib/types/lesson';

	interface Props {
		lesson: NDKAgentLesson;
	}

	let { lesson }: Props = $props();

	// Form state
	let newCommentContent = $state('');
	let isSubmittingComment = $state(false);
	let submitError = $state<string | null>(null);
	let textareaRef: HTMLTextAreaElement | null = $state(null);

	// Pagination state
	let displayedCommentCount = $state(DEFAULT_COMMENT_LIMIT);
	const COMMENTS_PER_PAGE = 20;

	// Subscribe to comments for this lesson using the service
	const commentsSubscription = ndk.$subscribe(() =>
		createCommentSubscriptionOptions({
			lessonId: lesson.id,
			lessonPubkey: lesson.pubkey,
			limit: displayedCommentCount
		})
	);

	// Subscription state tracking
	const isLoadingComments = $derived(!commentsSubscription.eosed);

	// Transform raw events to typed comments
	const lessonComments: LessonComment[] = $derived.by(() => {
		const rawEvents = commentsSubscription.events || [];
		return transformToComments(rawEvents);
	});

	// Pagination helpers
	const hasMoreComments = $derived(lessonComments.length >= displayedCommentCount);

	function loadMoreComments(): void {
		displayedCommentCount += COMMENTS_PER_PAGE;
	}

	// Comment submission
	async function handleSubmitComment(): Promise<void> {
		if (!ndk || !ndk.$currentUser || !newCommentContent.trim() || isSubmittingComment) {
			return;
		}

		const content = newCommentContent.trim();
		isSubmittingComment = true;
		submitError = null;

		try {
			const commentEvent = createCommentEvent(ndk, lesson, content);
			await publishComment(commentEvent);

			newCommentContent = '';
			textareaRef?.focus();
		} catch (error) {
			console.error('Failed to post comment:', error);
			submitError = error instanceof Error ? error.message : 'Failed to post comment';
		} finally {
			isSubmittingComment = false;
		}
	}

	function handleKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmitComment();
		}
	}
</script>

<div class="space-y-4">
	<!-- Comments Header -->
	<div class="flex items-center gap-2">
		<MessageCircle class="h-5 w-5 text-muted-foreground" />
		<h3 class="font-semibold text-foreground">
			Comments ({lessonComments.length})
		</h3>
		{#if isLoadingComments}
			<Spinner size="sm" />
		{/if}
	</div>

	<!-- Comment Form -->
	{#if ndk.$currentUser}
		<div class="flex gap-3">
			<User.Root {ndk} pubkey={ndk.$currentUser.pubkey}>
				<User.Avatar class="w-8 h-8 flex-shrink-0" />
			</User.Root>
			<div class="flex-1 relative">
				<textarea
					bind:this={textareaRef}
					bind:value={newCommentContent}
					onkeydown={handleKeyDown}
					placeholder="Write a comment..."
					disabled={isSubmittingComment}
					class="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-muted-foreground"
					rows="2"
				></textarea>
				<button
					type="button"
					onclick={handleSubmitComment}
					disabled={isSubmittingComment || !newCommentContent.trim()}
					class="absolute bottom-2 right-2 p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					aria-label="Post comment"
				>
					{#if isSubmittingComment}
						<Spinner size="sm" class="text-primary-foreground" />
					{:else}
						<Send class="h-4 w-4" />
					{/if}
				</button>
			</div>
		</div>
		{#if submitError}
			<p class="text-sm text-destructive">{submitError}</p>
		{/if}
	{:else}
		<div class="bg-muted/50 rounded-lg p-4 text-center">
			<p class="text-sm text-muted-foreground">Log in to leave a comment</p>
		</div>
	{/if}

	<!-- Comments List -->
	{#if lessonComments.length > 0}
		<div class="space-y-4 mt-6">
			{#each lessonComments as comment (comment.id)}
				<article class="flex gap-3">
					<User.Root {ndk} pubkey={comment.pubkey}>
						<User.Avatar class="w-8 h-8 flex-shrink-0" />
					</User.Root>
					<div class="flex-1 min-w-0">
						<header class="flex items-center gap-2 mb-1">
							<User.Root {ndk} pubkey={comment.pubkey}>
								<span class="font-medium text-sm text-foreground">
									<User.Name />
								</span>
							</User.Root>
							<time class="text-xs text-muted-foreground">
								{formatRelativeTime(comment.createdAt)}
							</time>
						</header>
						<p class="text-sm text-foreground whitespace-pre-wrap break-words">
							{comment.content}
						</p>
					</div>
				</article>
			{/each}

			<!-- Load More Button -->
			{#if hasMoreComments}
				<div class="text-center pt-4">
					<button
						type="button"
						onclick={loadMoreComments}
						class="text-sm text-primary hover:text-primary/80 transition-colors"
					>
						Load more comments
					</button>
				</div>
			{/if}
		</div>
	{:else if !isLoadingComments}
		<div class="text-center py-8">
			<MessageCircle class="h-8 w-8 text-muted-foreground mx-auto mb-2" />
			<p class="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
		</div>
	{/if}
</div>
