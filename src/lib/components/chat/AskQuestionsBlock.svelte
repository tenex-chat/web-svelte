<script lang="ts">
	import type { AskQuestions, QuestionResponse } from '$lib/utils/askTags';
	import { formatQuestionResponses } from '$lib/utils/askTags';
	import { cn } from '$lib/utils/cn';
	import { Send } from 'lucide-svelte';
	import { Streamdown } from 'svelte-streamdown';

	interface Props {
		questions: AskQuestions;
		content?: string;
		onResponse: (content: string) => void;
		class?: string;
	}

	let { questions, content, onResponse, class: className }: Props = $props();

	// Track responses for each question
	// For 'question' type: string (single selection or custom text)
	// For 'multiselect' type: string[] (multiple selections)
	let responses = $state<Record<string, string | string[]>>({});

	// Track custom text inputs for each question
	let customInputs = $state<Record<string, string>>({});

	// Track if custom input is being used for each question
	let usingCustomInput = $state<Record<string, boolean>>({});

	function handleOptionSelect(questionId: string, option: string, isMultiselect: boolean) {
		// When selecting an option, disable custom input mode
		usingCustomInput[questionId] = false;

		if (isMultiselect) {
			const current = (responses[questionId] as string[]) || [];
			if (current.includes(option)) {
				// Remove if already selected
				responses[questionId] = current.filter((o) => o !== option);
			} else {
				// Add to selections
				responses[questionId] = [...current, option];
			}
		} else {
			// Single selection - toggle off if clicking same option
			if (responses[questionId] === option) {
				responses[questionId] = '';
			} else {
				responses[questionId] = option;
			}
		}
	}

	function handleCustomInputFocus(questionId: string) {
		usingCustomInput[questionId] = true;
		// Clear option selection when using custom input
		const question = questions.questions.find((q) => q.id === questionId);
		if (question?.type === 'multiselect') {
			responses[questionId] = [];
		} else {
			responses[questionId] = '';
		}
	}

	function handleCustomInputChange(questionId: string, value: string, isMultiselect: boolean) {
		customInputs[questionId] = value;
		if (usingCustomInput[questionId]) {
			if (isMultiselect) {
				// For multiselect, treat custom input as a single custom answer
				responses[questionId] = value ? [value] : [];
			} else {
				responses[questionId] = value;
			}
		}
	}

	function isOptionSelected(questionId: string, option: string, isMultiselect: boolean): boolean {
		if (usingCustomInput[questionId]) return false;

		if (isMultiselect) {
			const current = (responses[questionId] as string[]) || [];
			return current.includes(option);
		}
		return responses[questionId] === option;
	}

	function hasAnyResponse(): boolean {
		// Check if at least one question has a response
		return questions.questions.some((q) => {
			const response = responses[q.id];
			if (q.type === 'multiselect') {
				return Array.isArray(response) && response.length > 0;
			}
			return typeof response === 'string' && response.length > 0;
		});
	}

	function handleSubmit() {
		// Only include questions that have responses
		const questionResponses: QuestionResponse[] = questions.questions
			.filter((q) => {
				const response = responses[q.id];
				if (q.type === 'multiselect') {
					return Array.isArray(response) && response.length > 0;
				}
				return typeof response === 'string' && response.length > 0;
			})
			.map((q) => ({
				questionId: q.id,
				answer: responses[q.id] || (q.type === 'multiselect' ? [] : '')
			}));

		const formatted = formatQuestionResponses(questionResponses, questions);
		onResponse(formatted);
	}
</script>

<div
	class={cn(
		'space-y-4 p-4 bg-muted/30 border border-border rounded-lg',
		className
	)}
>
	<!-- Overall title -->
	{#if questions.title}
		<h3 class="text-base font-semibold text-foreground">
			{questions.title}
		</h3>
	{/if}

	<!-- Context/explanation from the event content -->
	{#if content}
		<div class="prose prose-sm text-sm max-w-none dark:prose-invert text-muted-foreground">
			<Streamdown
				{content}
				class="prose prose-sm text-sm max-w-none dark:prose-invert text-muted-foreground"
				parseIncompleteMarkdown={true}
				animation={{ enabled: false }}
				baseTheme="shadcn"
				shikiTheme="github-dark-dimmed"
			/>
		</div>
	{/if}

	<!-- Questions -->
	{#each questions.questions as question, index (question.id)}
		<div class="space-y-2">
			<!-- Question header with short title -->
			<div>
				{#if question.id}
					<p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">
						{question.id}
					</p>
				{/if}
				<p class="text-sm font-medium text-foreground mt-0.5">
					{question.question}
				</p>
				{#if question.type === 'multiselect'}
					<p class="text-xs text-muted-foreground mt-0.5">
						Select all that apply
					</p>
				{/if}
			</div>

			<!-- Options in vertical layout -->
			{#if question.options && question.options.length > 0}
				<div class="flex flex-col gap-1.5">
					{#each question.options as option, optIndex (`${question.id}-opt-${optIndex}`)}
						<button
							type="button"
							onclick={() => handleOptionSelect(question.id, option, question.type === 'multiselect')}
							class={cn(
								'w-full text-left px-3 py-2 text-sm rounded-md border transition-all',
								isOptionSelected(question.id, option, question.type === 'multiselect')
									? 'bg-primary text-primary-foreground border-primary'
									: 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50'
							)}
						>
							{#if question.type === 'multiselect'}
								<span class="mr-2 opacity-60">
									{isOptionSelected(question.id, option, true) ? '✓' : '○'}
								</span>
							{/if}
							{option}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Custom input -->
			<input
				type="text"
				placeholder={question.options?.length ? 'Or type your own answer...' : 'Type your answer...'}
				value={customInputs[question.id] || ''}
				onfocus={() => handleCustomInputFocus(question.id)}
				oninput={(e) =>
					handleCustomInputChange(
						question.id,
						(e.target as HTMLInputElement).value,
						question.type === 'multiselect'
					)}
				class={cn(
					'w-full px-3 py-2 text-sm rounded-md border transition-all',
					'bg-background text-foreground placeholder:text-muted-foreground',
					usingCustomInput[question.id] && customInputs[question.id]
						? 'border-primary ring-1 ring-primary/20'
						: 'border-border focus:border-primary/50'
				)}
			/>

			<!-- Separator between questions -->
			{#if index < questions.questions.length - 1}
				<hr class="border-border mt-3" />
			{/if}
		</div>
	{/each}

	<!-- Submit button - always clickable -->
	<div class="flex justify-end pt-2">
		<button
			type="button"
			onclick={handleSubmit}
			class={cn(
				'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
				hasAnyResponse()
					? 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
					: 'bg-primary/60 hover:bg-primary/70 text-primary-foreground cursor-pointer'
			)}
		>
			<Send class="h-4 w-4" />
			Send Response
		</button>
	</div>
</div>
