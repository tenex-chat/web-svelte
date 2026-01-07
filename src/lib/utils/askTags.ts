import type { NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Extracts and parses the ask tag from an NDK event
 * The ask tag is used to mark events that are asking for user input/feedback
 * Format: ["ask", "true"] or just ["ask"]
 */
export interface AskTagInfo {
	isAsk: boolean;
	tldr: string | null;
	context: string | null;
	rawTag: string[] | undefined;
}

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
 * Parses ask-related tags from an event
 * Supports:
 * - ask tag: marks if event is asking a question
 * - tldr tag: brief summary of the context
 * - context tag: detailed context/background information
 */
export function parseAskTags(event: NDKEvent): AskTagInfo {
	const askTag = event.tags.find((tag) => tag[0] === 'ask');
	const tldrTag = event.tags.find((tag) => tag[0] === 'tldr');
	const contextTag = event.tags.find((tag) => tag[0] === 'context');

	const isAsk =
		askTag !== undefined && (askTag[1] === 'true' || askTag[1] === '1' || askTag.length === 1);

	return {
		isAsk,
		tldr: tldrTag?.[1] ?? null,
		context: contextTag?.[1] ?? null,
		rawTag: askTag
	};
}

/**
 * Checks if an event has the ask tag set to true
 */
export function isAskEvent(event: NDKEvent): boolean {
	return parseAskTags(event).isAsk;
}

/**
 * Gets the TLDR (Too Long; Didn't Read) summary for an ask event
 */
export function getAskTLDR(event: NDKEvent): string | null {
	return parseAskTags(event).tldr;
}

/**
 * Gets the context/background information for an ask event
 */
export function getAskContext(event: NDKEvent): string | null {
	return parseAskTags(event).context;
}

/**
 * Checks if an ask event has context that can be collapsed
 */
export function hasAskContext(event: NDKEvent): boolean {
	return getAskContext(event) !== null;
}

/**
 * Metadata attached to an event after parsing ask tags
 */
export interface AskMetadata {
	isAsk: boolean;
	tldr: string | null;
	context: string | null;
	questions?: AskQuestions;
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

/**
 * Annotates an event with ask metadata by directly attaching it as a property.
 * This should be called once when the event is loaded, before display.
 * The metadata is then available as event.askMeta in components.
 *
 * @param event The NDKEvent to annotate
 * @returns The same event with askMeta property attached
 */
export function annotateEventWithAskMeta(event: NDKEvent): NDKEvent {
	const askInfo = parseAskTags(event);
	const questions = parseAskQuestions(event);
	(event as any).askMeta = {
		isAsk: askInfo.isAsk,
		tldr: askInfo.tldr,
		context: askInfo.context,
		questions: questions ?? undefined
	} as AskMetadata;
	return event;
}
