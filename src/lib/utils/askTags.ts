import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Represents a single question in a multi-question ask event
 * Format: ["question", "ID", "Text", "Opt1", ...] or ["multiselect", "ID", "Text", "Opt1", ...]
 */
export interface AskQuestion {
	id: string;
	type: 'question' | 'multiselect';
	question: string;
	options?: string[];
	response?: string | string[];
}

/**
 * Container for multiple questions from an ask event
 */
export interface AskQuestions {
	questions: AskQuestion[];
	count: number;
	title?: string;
}

/**
 * Response to a single question
 */
export interface QuestionResponse {
	questionId: string;
	answer: string | string[];
}

/**
 * Checks if an event has the ask tag set to true
 * Supports: ["ask", "true"], ["ask", "1"], or just ["ask"]
 */
export function isAskEvent(event: NDKEvent): boolean {
	const askTag = event.tags.find((tag) => tag[0] === 'ask');
	return askTag !== undefined && (askTag[1] === 'true' || askTag[1] === '1' || askTag.length === 1);
}

/**
 * Parses question and multiselect tags from an event into structured format
 * Supports:
 * - title tag: ["title", "Overall Title"]
 * - question tag: ["question", "Short Title", "Full Question Text", "Opt1", "Opt2", ...]
 * - multiselect tag: ["multiselect", "Short Title", "Full Question Text", "Opt1", "Opt2", ...]
 */
export function parseAskQuestions(event: NDKEvent): AskQuestions | null {
	const questionTags = event.tags.filter(
		(tag) => tag[0] === 'question' || tag[0] === 'multiselect'
	);

	if (questionTags.length === 0) {
		return null;
	}

	// Get the overall title from the title tag
	const titleTag = event.tags.find((tag) => tag[0] === 'title');
	const title = titleTag?.[1] ?? undefined;

	const questions: AskQuestion[] = questionTags.map((tag) => {
		const type = tag[0] as 'question' | 'multiselect';
		const id = tag[1] || ''; // This is actually the short title for the question
		const questionText = tag[2] || '';
		const options = tag.length > 3 ? tag.slice(3) : undefined;

		return {
			id,
			type,
			question: questionText,
			options
		};
	});

	return {
		questions,
		count: questions.length,
		title
	};
}

/**
 * Checks if an event has question/multiselect tags
 */
export function hasAskQuestions(event: NDKEvent): boolean {
	return event.tags.some((tag) => tag[0] === 'question' || tag[0] === 'multiselect');
}

/**
 * Gets the parsed questions from an event
 */
export function getAskQuestions(event: NDKEvent): AskQuestions | null {
	return parseAskQuestions(event);
}

/**
 * Checks if an event is a multi-question ask event
 * (has ask tag AND has question/multiselect tags)
 */
export function isMultiQuestionAskEvent(event: NDKEvent): boolean {
	return isAskEvent(event) && hasAskQuestions(event);
}

/**
 * Formats question responses into a readable string
 * Format: "**Question Text:** Answer" for each question
 */
export function formatQuestionResponses(
	responses: QuestionResponse[],
	questions: AskQuestions
): string {
	const lines: string[] = [];

	for (const response of responses) {
		const question = questions.questions.find((q) => q.id === response.questionId);
		if (!question) continue;

		const answerText = Array.isArray(response.answer)
			? response.answer.join(', ')
			: response.answer;

		lines.push(`**${question.question}:** ${answerText}`);
	}

	return lines.join('\n\n');
}
