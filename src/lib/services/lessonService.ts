/**
 * Lesson Service
 *
 * Centralized service for lesson-related Nostr operations.
 * Provides methods for fetching lessons and comments, as well as
 * creating and publishing new comments.
 */

import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKFilter } from '@nostr-dev-kit/ndk';
import { NDKKind } from '$lib/kinds';
import type { NDKKind as NDKKindType } from '$lib/kinds';
import { NDKAgentLesson } from '$lib/events/NDKAgentLesson';
import type {
	LessonFetchOptions,
	CommentFetchOptions,
	LessonComment,
	LessonMetadata
} from '$lib/types/lesson';
import { eventToComment, extractLessonMetadata } from '$lib/types/lesson';

/** Default pagination limits */
export const DEFAULT_LESSON_LIMIT = 50;
export const DEFAULT_COMMENT_LIMIT = 100;

/** NIP-22 Comment kind */
const COMMENT_KIND = 1111;

/**
 * Builds a filter for fetching lessons.
 */
export function buildLessonFilter(options: LessonFetchOptions = {}): NDKFilter<NDKKindType> {
	const filter: NDKFilter<NDKKindType> = {
		kinds: [NDKKind.AgentLesson as NDKKindType],
		limit: options.limit ?? DEFAULT_LESSON_LIMIT
	};

	if (options.authors?.length) {
		filter.authors = options.authors;
	}

	if (options.hashtags?.length) {
		filter['#t'] = options.hashtags;
	}

	return filter;
}

/**
 * Builds a filter for fetching comments on a lesson.
 * Supports both NIP-22 (kind 1111) and legacy (kind 1) comments.
 */
export function buildCommentFilter(options: CommentFetchOptions): NDKFilter<NDKKindType>[] {
	const baseFilter = {
		'#e': [options.lessonId],
		limit: options.limit ?? DEFAULT_COMMENT_LIMIT
	};

	return [
		{
			...baseFilter,
			kinds: [COMMENT_KIND as NDKKindType, 1 as NDKKindType]
		}
	];
}

/**
 * Transforms raw NDKEvent array to typed lessons.
 */
export function transformToLessons(events: NDKEvent[]): NDKAgentLesson[] {
	return events.map((event) => NDKAgentLesson.from(event));
}

/**
 * Transforms raw NDKEvent array to typed comments, sorted oldest first.
 */
export function transformToComments(events: NDKEvent[]): LessonComment[] {
	return [...events]
		.sort((a, b) => (a.created_at || 0) - (b.created_at || 0))
		.map(eventToComment);
}

/**
 * Extracts metadata from multiple lessons.
 */
export function extractLessonsMetadata(lessons: NDKAgentLesson[]): LessonMetadata[] {
	return lessons.map(extractLessonMetadata);
}

/**
 * Creates a NIP-22 comment event for a lesson.
 *
 * @param ndk - NDK instance
 * @param lesson - The lesson to comment on
 * @param content - Comment content
 * @returns The created comment event (not yet signed or published)
 */
export function createCommentEvent(
	ndk: any,
	lesson: NDKAgentLesson,
	content: string
): NDKEvent {
	const comment = new NDKEvent(ndk);
	comment.kind = COMMENT_KIND as NDKKindType;
	comment.content = content;

	// NIP-22 tagging: root event reference with 'root' marker
	// Format: ['e', <event-id>, <relay-hint>, <marker>, <pubkey>]
	comment.tags = [
		['e', lesson.id, '', 'root', lesson.pubkey],
		['p', lesson.pubkey],
		['K', String(lesson.kind)],
		['k', String(lesson.kind)]
	];

	return comment;
}

/**
 * Signs and publishes a comment event.
 *
 * @param comment - The comment event to publish
 * @throws Error if signing or publishing fails
 */
export async function publishComment(comment: NDKEvent): Promise<void> {
	await comment.sign();
	await comment.publish();
}

/**
 * Creates subscription options for lessons.
 */
export function createLessonSubscriptionOptions(options: LessonFetchOptions = {}) {
	return {
		filters: [buildLessonFilter(options)],
		closeOnEose: options.closeOnEose ?? false
	};
}

/**
 * Creates subscription options for comments.
 */
export function createCommentSubscriptionOptions(options: CommentFetchOptions) {
	return {
		filters: buildCommentFilter(options),
		closeOnEose: options.closeOnEose ?? false
	};
}
