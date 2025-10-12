<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKThread, NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';

	interface Props {
		project?: NDKProject;
		rootEvent?: NDKEvent | null;
		onlineAgents?: ProjectAgent[];
		onThreadCreated?: (thread: NDKEvent) => void;
	}

	let { project, rootEvent, onlineAgents = [], onThreadCreated }: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);

	let messageInput = $state('');
	let selectedAgent = $state<string | null>(null);
	let isSubmitting = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);

	// @mention autocomplete state
	let showMentionAutocomplete = $state(false);
	let mentionQuery = $state('');
	let mentionStartPos = $state(0);
	let selectedMentionIndex = $state(0);
	let mentionedAgents = $state<string[]>([]);

	// Filter agents for autocomplete
	const filteredAgents = $derived.by(() => {
		if (!showMentionAutocomplete) return [];
		const query = mentionQuery.toLowerCase();
		return onlineAgents.filter((agent) => agent.name.toLowerCase().includes(query));
	});

	// Detect @ mentions and update autocomplete
	function handleInput() {
		if (!textareaElement) return;

		const cursorPos = textareaElement.selectionStart;
		const textBeforeCursor = messageInput.substring(0, cursorPos);

		// Find the last @ before cursor
		const lastAtIndex = textBeforeCursor.lastIndexOf('@');

		if (lastAtIndex !== -1) {
			// Check if there's a space before @ (or it's at start)
			const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
			const isAtWordBoundary = /\s/.test(charBeforeAt);

			// Extract text between @ and cursor
			const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

			// Check if there's no space after @
			const hasNoSpace = !textAfterAt.includes(' ');

			if (isAtWordBoundary && hasNoSpace) {
				showMentionAutocomplete = true;
				mentionQuery = textAfterAt;
				mentionStartPos = lastAtIndex;
				selectedMentionIndex = 0;
				return;
			}
		}

		// Hide autocomplete
		showMentionAutocomplete = false;
		mentionQuery = '';
	}

	// Insert mention into textarea
	function selectMention(agent: ProjectAgent) {
		const before = messageInput.substring(0, mentionStartPos);
		const after = messageInput.substring(textareaElement?.selectionStart || 0);
		const mention = `@${agent.name} `;

		messageInput = before + mention + after;

		// Add to mentioned agents for p-tagging
		if (!mentionedAgents.includes(agent.pubkey)) {
			mentionedAgents = [...mentionedAgents, agent.pubkey];
		}

		// Hide autocomplete
		showMentionAutocomplete = false;
		mentionQuery = '';

		// Focus and set cursor after mention
		setTimeout(() => {
			if (textareaElement) {
				const newCursorPos = before.length + mention.length;
				textareaElement.focus();
				textareaElement.setSelectionRange(newCursorPos, newCursorPos);
			}
		}, 0);
	}

	async function handleSend() {
		if (!ndk || !currentUser || !messageInput.trim() || isSubmitting) return;

		isSubmitting = true;
		try {
			const content = messageInput.trim();
			messageInput = ''; // Clear immediately for better UX

			if (!rootEvent) {
				// CREATE NEW THREAD (kind:11)
				const thread = new NDKThread(ndk);
				thread.content = content;
				thread.title = content.slice(0, 50);

				// Add project reference
				if (project) {
					const projectRef = project.tagReference();
					thread.tags.push(projectRef);
				}

				// Extract hashtags from content
				const hashtagMatches = content.matchAll(/#(\w+)/g);
				for (const match of hashtagMatches) {
					thread.tags.push(['t', match[1].toLowerCase()]);
				}

				// P-TAG ROUTING for new thread (PRIORITY: @mentions > selectedAgent > default PM)
				if (mentionedAgents.length > 0) {
					// Add all mentioned agents as p-tags
					for (const pubkey of mentionedAgents) {
						thread.tags.push(['p', pubkey]);
					}
				} else if (selectedAgent) {
					thread.tags.push(['p', selectedAgent]);
				} else if (onlineAgents.length > 0) {
					// Default to Project Manager (first agent)
					thread.tags.push(['p', onlineAgents[0].pubkey]);
				}

				// Sign and publish
				await thread.sign(undefined, { pTags: false });
				await thread.publish();

				// Notify parent
				if (onThreadCreated) {
					onThreadCreated(thread);
				}
			} else {
				// SEND REPLY (kind:1111)
				const reply = rootEvent.reply();
				reply.content = content;

				// Remove NDK's auto p-tags
				reply.tags = reply.tags.filter((tag) => tag[0] !== 'p');

				// Add project reference
				if (project) {
					const tagId = project.tagId();
					if (tagId) {
						reply.tags.push(['a', tagId]);
					}
				}

				// P-TAG ROUTING for reply (PRIORITY: @mentions > selectedAgent > default PM)
				if (mentionedAgents.length > 0) {
					// Add all mentioned agents as p-tags
					for (const pubkey of mentionedAgents) {
						reply.tags.push(['p', pubkey]);
					}
				} else if (selectedAgent) {
					reply.tags.push(['p', selectedAgent]);
				} else if (onlineAgents.length > 0) {
					// Default to PM
					reply.tags.push(['p', onlineAgents[0].pubkey]);
				}

				// Sign and publish
				await reply.sign(undefined, { pTags: false });
				await reply.publish();
			}

			// Reset state
			selectedAgent = null;
			mentionedAgents = [];
		} catch (error) {
			console.error('Failed to send message:', error);
			messageInput = content; // Restore message on error
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Handle autocomplete navigation
		if (showMentionAutocomplete && filteredAgents.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedMentionIndex = (selectedMentionIndex + 1) % filteredAgents.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedMentionIndex =
					selectedMentionIndex === 0 ? filteredAgents.length - 1 : selectedMentionIndex - 1;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				selectMention(filteredAgents[selectedMentionIndex]);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showMentionAutocomplete = false;
				return;
			}
		}

		// Normal send behavior
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}
</script>

<div class="border-t border-gray-200 p-3 bg-white">
	<!-- Agent Selector -->
	{#if onlineAgents.length > 0}
		<div class="mb-2 flex items-center gap-2">
			<span class="text-xs text-gray-500">To:</span>
			<select
				bind:value={selectedAgent}
				class="text-sm px-2 py-1 border border-gray-300 rounded bg-white"
			>
				<option value={null}>Project Manager (default)</option>
				{#each onlineAgents as agent}
					<option value={agent.pubkey}>
						{agent.name}{agent.model ? ` (${agent.model})` : ''}
					</option>
				{/each}
			</select>
		</div>
	{/if}

	<!-- Input Area -->
	<div class="flex gap-2 relative">
		<div class="flex-1 relative">
			<textarea
				bind:this={textareaElement}
				bind:value={messageInput}
				oninput={handleInput}
				onkeydown={handleKeyDown}
				placeholder={rootEvent ? 'Type a message...' : 'Start a new conversation...'}
				disabled={isSubmitting || !currentUser}
				class="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
				rows="2"
			></textarea>

			<!-- @mention Autocomplete Dropdown -->
			{#if showMentionAutocomplete && filteredAgents.length > 0}
				<div
					class="absolute bottom-full left-0 mb-1 w-full max-w-xs bg-white border border-gray-300 rounded-lg shadow-lg overflow-hidden z-50"
				>
					<div class="max-h-48 overflow-y-auto">
						{#each filteredAgents as agent, index (agent.pubkey)}
							<button
								type="button"
								onclick={() => selectMention(agent)}
								onmouseenter={() => (selectedMentionIndex = index)}
								class="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors {index ===
								selectedMentionIndex
									? 'bg-blue-100'
									: ''}"
							>
								<div class="font-medium text-sm">{agent.name}</div>
								{#if agent.model}
									<div class="text-xs text-gray-500">{agent.model}</div>
								{/if}
							</button>
						{/each}
					</div>
					<div class="px-3 py-1 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
						↑↓ navigate • ↵ select • esc dismiss
					</div>
				</div>
			{/if}
		</div>

		<button
			onclick={handleSend}
			disabled={isSubmitting || !messageInput.trim() || !currentUser}
			class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium self-end"
			aria-label="Send message"
		>
			{#if isSubmitting}
				<svg
					class="w-5 h-5 animate-spin"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
			{:else}
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
					/>
				</svg>
			{/if}
		</button>
	</div>

	<!-- Mentioned Agents Indicator -->
	{#if mentionedAgents.length > 0}
		<div class="mt-2 flex items-center gap-2 flex-wrap">
			<span class="text-xs text-gray-500">Mentioning:</span>
			{#each mentionedAgents as pubkey (pubkey)}
				{@const agent = onlineAgents.find((a) => a.pubkey === pubkey)}
				{#if agent}
					<span
						class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs"
					>
						<span>@{agent.name}</span>
						<button
							type="button"
							onclick={() => {
								mentionedAgents = mentionedAgents.filter((p) => p !== pubkey);
							}}
							class="hover:bg-blue-200 rounded-full p-0.5"
							aria-label="Remove mention"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}

	<p class="text-xs text-gray-500 mt-2">
		Press Enter to send, Shift+Enter for new line. Type @ to mention agents.
	</p>
</div>
