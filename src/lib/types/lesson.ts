/**
 * Type definitions for lesson-related components.
 *
 * These types provide proper TypeScript interfaces for lesson data
 * and enable type-safe operations throughout the lesson module.
 */

import type { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKAgentLesson } from '$lib/events/NDKAgentLesson';

/**
 * Represents the core lesson metadata extracted from an NDKAgentLesson event.
 */
export interface LessonMetadata {
	/** Unique identifier for the lesson */
	id: string;
	/** Pubkey of the lesson author */
	pubkey: string;
	/** Lesson title */
	title: string;
	/** Lesson category (e.g., 'technical', 'process') */
	category?: string;
	/** Core lesson content (summary) */
	content: string;
	/** Detailed explanation of the lesson */
	detailed?: string;
	/** Reasoning behind the lesson */
	reasoning?: string;
	/** Metacognitive insights about learning */
	metacognition?: string;
	/** Reflection on the lesson application */
	reflection?: string;
	/** Associated hashtags */
	hashtags: string[];
	/** Unix timestamp of creation */
	createdAt: number;
}

/**
 * Configuration for fetching lessons.
 */
export interface LessonFetchOptions {
	/** Author pubkeys to filter by */
	authors?: string[];
	/** Maximum number of lessons to fetch */
	limit?: number;
	/** Hashtags to filter by */
	hashtags?: string[];
	/** Keep subscription open for live updates */
	closeOnEose?: boolean;
}

/**
 * Options for fetching lesson comments.
 */
export interface CommentFetchOptions {
	/** The lesson event ID to fetch comments for */
	lessonId: string;
	/** The lesson author's pubkey */
	lessonPubkey: string;
	/** Maximum number of comments to fetch */
	limit?: number;
	/** Keep subscription open for live updates */
	closeOnEose?: boolean;
}

/**
 * Represents a single comment on a lesson.
 */
export interface LessonComment {
	/** Unique identifier for the comment */
	id: string;
	/** Comment content */
	content: string;
	/** Pubkey of the comment author */
	pubkey: string;
	/** Unix timestamp of creation */
	createdAt: number;
	/** Original NDK event for additional operations */
	event: NDKEvent;
}

/**
 * Subscription state for async data loading.
 */
export interface SubscriptionState {
	/** Whether the initial data is still loading */
	isLoading: boolean;
	/** Error message if subscription failed */
	error: string | null;
	/** Whether the subscription has received initial data */
	hasReceivedEose: boolean;
}

/**
 * Extracts LessonMetadata from an NDKAgentLesson event.
 */
export function extractLessonMetadata(lesson: NDKAgentLesson): LessonMetadata {
	return {
		id: lesson.id,
		pubkey: lesson.pubkey,
		title: lesson.title || 'Untitled Lesson',
		category: lesson.category,
		content: lesson.lesson,
		detailed: lesson.detailed,
		reasoning: lesson.reasoning,
		metacognition: lesson.metacognition,
		reflection: lesson.reflection,
		hashtags: lesson.hashtags || [],
		createdAt: lesson.created_at || 0
	};
}

/**
 * Converts an NDKEvent to a LessonComment.
 */
export function eventToComment(event: NDKEvent): LessonComment {
	return {
		id: event.id,
		content: event.content,
		pubkey: event.pubkey,
		createdAt: event.created_at || 0,
		event
	};
}

/**
 * Calculates estimated reading time for text content.
 */
export function calculateReadingTime(text: string, wordsPerMinute = 200): string {
	if (!text) return '1 min';
	const words = text.trim().split(/\s+/).length;
	const minutes = Math.ceil(words / wordsPerMinute);
	return `${minutes} min read`;
}

/**
 * Combines multiple text sections for reading time calculation.
 */
export function combineTextSections(...sections: (string | undefined)[]): string {
	return sections.filter(Boolean).join(' ');
}
