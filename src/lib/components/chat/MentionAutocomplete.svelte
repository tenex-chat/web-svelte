<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';

	interface Props {
		messageInput: string;
		cursorPosition: number;
		onlineAgents: ProjectAgent[];
		onSelectMention: (agent: ProjectAgent, mention: string, startPos: number, endPos: number) => void;
		onKeyDown?: (e: KeyboardEvent) => boolean;
	}

	let { messageInput, cursorPosition, onlineAgents, onSelectMention, onKeyDown = $bindable(() => false) }: Props = $props();

	let showMentionAutocomplete = $state(false);
	let mentionQuery = $state('');
	let mentionStartPos = $state(0);
	let selectedMentionIndex = $state(0);

	const filteredAgents = $derived.by(() => {
		if (!showMentionAutocomplete) return [];
		const query = mentionQuery.toLowerCase();
		return onlineAgents.filter((agent) => agent.name.toLowerCase().includes(query));
	});

	const isActive = $derived(showMentionAutocomplete && filteredAgents.length > 0);

	function detectMention(input: string, cursor: number): { active: boolean; query: string; startPos: number } {
		const textBeforeCursor = input.substring(0, cursor);
		const lastAtIndex = textBeforeCursor.lastIndexOf('@');

		if (lastAtIndex === -1) {
			return { active: false, query: '', startPos: 0 };
		}

		const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
		const isAtWordBoundary = /\s/.test(charBeforeAt) || lastAtIndex === 0;
		const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
		const hasNoSpace = !textAfterAt.includes(' ');

		if (isAtWordBoundary && hasNoSpace) {
			return { active: true, query: textAfterAt, startPos: lastAtIndex };
		}

		return { active: false, query: '', startPos: 0 };
	}

	function handleKeyDownInternal(e: KeyboardEvent): boolean {
		if (!isActive) return false;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedMentionIndex = (selectedMentionIndex + 1) % filteredAgents.length;
			return true;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedMentionIndex = selectedMentionIndex === 0 ? filteredAgents.length - 1 : selectedMentionIndex - 1;
			return true;
		}
		if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			selectMention(filteredAgents[selectedMentionIndex]);
			return true;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			showMentionAutocomplete = false;
			return true;
		}

		return false;
	}

	function selectMention(agent: ProjectAgent) {
		const mention = `@${agent.name} `;
		const endPos = cursorPosition;
		onSelectMention(agent, mention, mentionStartPos, endPos);
		showMentionAutocomplete = false;
		mentionQuery = '';
	}

	// Detect mention based on input and cursor position
	$effect(() => {
		const result = detectMention(messageInput, cursorPosition);

		if (result.active) {
			showMentionAutocomplete = true;
			mentionQuery = result.query;
			mentionStartPos = result.startPos;
			selectedMentionIndex = 0;
		} else {
			showMentionAutocomplete = false;
			mentionQuery = '';
		}
	});

	// Expose keyboard handler to parent
	onKeyDown = handleKeyDownInternal;
</script>

<!-- @mention Autocomplete Dropdown -->
{#if isActive}
	<div
		class="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-popover/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg overflow-hidden z-50"
	>
		<div class="max-h-48 overflow-y-auto">
			{#each filteredAgents as agent, index (agent.pubkey)}
				<button
					type="button"
					onclick={() => selectMention(agent)}
					onmouseenter={() => (selectedMentionIndex = index)}
					class="w-full px-3 py-2 text-left hover:bg-blue-50/50 transition-colors {index === selectedMentionIndex
						? 'bg-blue-100/50'
						: ''}"
				>
					<div class="font-medium text-sm text-foreground">{agent.name}</div>
					{#if agent.model}
						<div class="text-xs text-muted-foreground">{agent.model}</div>
					{/if}
				</button>
			{/each}
		</div>
		<div class="px-3 py-1 bg-muted/50 backdrop-blur-sm border-t border-border/50 text-xs text-muted-foreground">
			↑↓ navigate • ↵ select • esc dismiss
		</div>
	</div>
{/if}
