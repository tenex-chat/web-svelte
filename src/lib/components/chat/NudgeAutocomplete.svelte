<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk.svelte';
	import { nudgeStore } from '$lib/stores/nudges.svelte';
	import NudgeAutocompleteItem from './NudgeAutocompleteItem.svelte';

	interface Props {
		messageInput: string;
		cursorPosition: number;
		selectedNudges: string[];
		onSelectNudge: (nudge: NDKEvent, startPos: number, endPos: number) => void;
		onKeyDown?: (e: KeyboardEvent) => boolean;
	}

	let { messageInput, cursorPosition, selectedNudges, onSelectNudge, onKeyDown = $bindable(() => false) }: Props = $props();

	let showNudgeAutocomplete = $state(false);
	let nudgeQuery = $state('');
	let nudgeStartPos = $state(0);
	let selectedNudgeIndex = $state(0);

	const filteredNudges = $derived.by(() => {
		if (!showNudgeAutocomplete) return [];
		const query = nudgeQuery.toLowerCase();
		const displayNudges = nudgeStore.getDisplayNudges(ndk.$currentUser?.pubkey);
		return displayNudges.filter((nudge) => {
			const title = nudge.tagValue('title') || '';
			const description = nudge.tagValue('description') || '';
			return title.toLowerCase().includes(query) || description.toLowerCase().includes(query);
		});
	});

	const isActive = $derived(showNudgeAutocomplete && filteredNudges.length > 0);

	function detectNudge(input: string, cursor: number): { active: boolean; query: string; startPos: number } {
		const textBeforeCursor = input.substring(0, cursor);
		const lastSlashIndex = textBeforeCursor.lastIndexOf('/');

		if (lastSlashIndex === -1) {
			return { active: false, query: '', startPos: 0 };
		}

		const charBeforeSlash = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : ' ';
		const isAtWordBoundary = /\s/.test(charBeforeSlash) || lastSlashIndex === 0;
		const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1);
		const hasNoSpace = !textAfterSlash.includes(' ');

		if (isAtWordBoundary && hasNoSpace) {
			return { active: true, query: textAfterSlash, startPos: lastSlashIndex };
		}

		return { active: false, query: '', startPos: 0 };
	}

	function handleKeyDownInternal(e: KeyboardEvent): boolean {
		if (!isActive) return false;

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedNudgeIndex = (selectedNudgeIndex + 1) % filteredNudges.length;
			return true;
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedNudgeIndex = selectedNudgeIndex === 0 ? filteredNudges.length - 1 : selectedNudgeIndex - 1;
			return true;
		}
		if (e.key === 'Enter' || e.key === 'Tab') {
			e.preventDefault();
			selectNudge(filteredNudges[selectedNudgeIndex]);
			return true;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			showNudgeAutocomplete = false;
			return true;
		}

		return false;
	}

	function selectNudge(nudge: NDKEvent) {
		const endPos = cursorPosition;
		onSelectNudge(nudge, nudgeStartPos, endPos);
		showNudgeAutocomplete = false;
		nudgeQuery = '';
	}

	// Detect nudge based on input and cursor position
	$effect(() => {
		const result = detectNudge(messageInput, cursorPosition);

		if (result.active) {
			showNudgeAutocomplete = true;
			nudgeQuery = result.query;
			nudgeStartPos = result.startPos;
			selectedNudgeIndex = 0;
		} else {
			showNudgeAutocomplete = false;
			nudgeQuery = '';
		}
	});

	// Expose keyboard handler to parent
	onKeyDown = handleKeyDownInternal;
</script>

<!-- /nudge Autocomplete Dropdown -->
{#if isActive}
	<div
		class="absolute bottom-full left-0 mb-2 w-full max-w-md bg-popover/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg overflow-hidden z-50"
	>
		<div class="max-h-64 overflow-y-auto">
			{#each filteredNudges as nudge, index (nudge.id)}
				<NudgeAutocompleteItem
					{nudge}
					isActive={selectedNudges.includes(nudge.id)}
					isSelected={index === selectedNudgeIndex}
					onclick={() => selectNudge(nudge)}
					onmouseenter={() => (selectedNudgeIndex = index)}
				/>
			{/each}
		</div>
		<div class="px-3 py-1 bg-muted/50 backdrop-blur-sm border-t border-border/50 text-xs text-muted-foreground">
			↑↓ navigate • ↵ select • esc dismiss
		</div>
	</div>
{/if}
