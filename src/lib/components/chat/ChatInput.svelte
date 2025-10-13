<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKThread, NDKKind, type NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import AgentConfigDialog from './AgentConfigDialog.svelte';
	import AgentSelector from './AgentSelector.svelte';

	interface Props {
		project?: NDKProject;
		rootEvent?: NDKEvent | null;
		onlineAgents?: ProjectAgent[];
		onThreadCreated?: (thread: NDKEvent) => void;
		replyToEvent?: NDKEvent | null;
		onCancelReply?: () => void;
		initialContent?: string;
	}

	let {
		project,
		rootEvent,
		onlineAgents = [],
		onThreadCreated,
		replyToEvent = null,
		onCancelReply,
		initialContent = ''
	}: Props = $props();

	const currentUser = $derived(ndk.$sessions.currentUser);
	const projectId = $derived(project?.tagId());
	const availableModels = $derived(projectId ? projectStatusStore.getModels(projectId) : []);
	const availableTools = $derived(projectId ? projectStatusStore.getTools(projectId) : []);

	let messageInput = $state('');
	let selectedAgent = $state<string | null>(null);
	let isSubmitting = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let configDialogOpen = $state(false);

	// Set initial content when provided
	$effect(() => {
		if (initialContent) {
			messageInput = initialContent;
		}
	});

	// Derive the current agent (selected or default to first agent)
	const currentAgent = $derived(
		selectedAgent || (onlineAgents.length > 0 ? onlineAgents[0].pubkey : null)
	);

	// Fetch profile for reply-to user
	const replyToProfile = $derived.by(() => {
		if (!replyToEvent) return null;
		return ndk.$fetchProfile(() => replyToEvent.pubkey);
	});

	const replyToAuthorName = $derived(
		replyToProfile?.displayName || replyToProfile?.name || replyToEvent?.pubkey.slice(0, 8)
	);

	// Automatically sync model with the selected/current agent from project status
	const currentAgentModel = $derived.by(() => {
		if (!currentAgent || !projectId) return null;
		const status = projectStatusStore.getStatus(projectId);
		if (!status) return null;
		const agent = status.agents.find((a) => a.pubkey === currentAgent);
		return agent?.model || null;
	});

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

		const content = messageInput.trim();
		isSubmitting = true;
		try {
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

				// If replying to a specific message, add e-tag for that event
				if (replyToEvent) {
					// Check if e-tag doesn't already exist
					const hasETag = reply.tags.some((tag) => tag[0] === 'e' && tag[1] === replyToEvent.id);
					if (!hasETag) {
						reply.tags.push(['e', replyToEvent.id, '', 'reply']);
					}
					// Also add p-tag for the author of the message being replied to
					const hasReplyAuthorPTag = reply.tags.some(
						(tag) => tag[0] === 'p' && tag[1] === replyToEvent.pubkey
					);
					if (!hasReplyAuthorPTag) {
						reply.tags.push(['p', replyToEvent.pubkey]);
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
			// Clear reply context
			if (onCancelReply) {
				onCancelReply();
			}
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

	function handleAgentConfigSave(config: { model: string; tools: string[] }) {
		// TODO: Implement agent config update via Nostr event
		console.log('Saving agent config:', config);
		// This would publish a kind:24010 event to update the agent configuration
	}
</script>

<div class="border-t border-gray-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
	<!-- Reply Context -->
	{#if replyToEvent}
		<div class="mb-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 dark:border-blue-400 rounded flex items-center gap-2">
			<svg class="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
				/>
			</svg>
			<div class="flex-1 min-w-0">
				<div class="text-xs text-blue-600 dark:text-blue-400 font-medium">Replying to {replyToAuthorName}</div>
				<div class="text-xs text-blue-800 dark:text-blue-300 truncate">
					{replyToEvent.content.slice(0, 100)}{replyToEvent.content.length > 100 ? '...' : ''}
				</div>
			</div>
			<button
				type="button"
				onclick={onCancelReply}
				class="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors text-blue-600 dark:text-blue-400"
				aria-label="Cancel reply"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	{/if}

	<!-- Input Area -->
	<div class="flex flex-col gap-3">
		<div class="flex-1 relative">
			<textarea
				bind:this={textareaElement}
				bind:value={messageInput}
				oninput={handleInput}
				onkeydown={handleKeyDown}
				placeholder={rootEvent ? 'Type a message...' : 'Start a new conversation...'}
				disabled={isSubmitting || !currentUser}
				class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:bg-gray-100 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed placeholder:text-gray-400 dark:placeholder:text-gray-500"
				rows="2"
			></textarea>

			<!-- @mention Autocomplete Dropdown -->
			{#if showMentionAutocomplete && filteredAgents.length > 0}
				<div
					class="absolute bottom-full left-0 mb-1 w-full max-w-xs bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg overflow-hidden z-50"
				>
					<div class="max-h-48 overflow-y-auto">
						{#each filteredAgents as agent, index (agent.pubkey)}
							<button
								type="button"
								onclick={() => selectMention(agent)}
								onmouseenter={() => (selectedMentionIndex = index)}
								class="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors {index ===
								selectedMentionIndex
									? 'bg-blue-100 dark:bg-blue-900/50'
									: ''}"
							>
								<div class="font-medium text-sm text-gray-900 dark:text-gray-100">{agent.name}</div>
								{#if agent.model}
									<div class="text-xs text-gray-500 dark:text-gray-400">{agent.model}</div>
								{/if}
							</button>
						{/each}
					</div>
					<div class="px-3 py-1 bg-gray-50 dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-700 text-xs text-gray-500 dark:text-gray-400">
						↑↓ navigate • ↵ select • esc dismiss
					</div>
				</div>
			{/if}
		</div>

		<!-- Controls Row: Agent Selector, Attachment -->
		<div class="flex items-center gap-2">
			<!-- Agent Selector -->
			{#if onlineAgents.length > 0}
				<AgentSelector
					agents={onlineAgents}
					selectedAgent={selectedAgent}
					currentModel={currentAgentModel}
					onSelect={(pubkey) => (selectedAgent = pubkey)}
					onConfigure={() => (configDialogOpen = true)}
				/>
			{/if}

			<!-- Attachment Button -->
			<button
				class="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors text-gray-600 dark:text-gray-400"
				type="button"
				title="Attach file"
				aria-label="Attach file"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
					/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Mentioned Agents Indicator -->
	{#if mentionedAgents.length > 0}
		<div class="mt-3 flex items-center gap-2 flex-wrap">
			<span class="text-xs text-gray-500 dark:text-gray-400">Mentioning:</span>
			{#each mentionedAgents as pubkey (pubkey)}
				{@const agent = onlineAgents.find((a) => a.pubkey === pubkey)}
				{#if agent}
					<span
						class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-xs"
					>
						<span>@{agent.name}</span>
						<button
							type="button"
							onclick={() => {
								mentionedAgents = mentionedAgents.filter((p) => p !== pubkey);
							}}
							class="hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-full p-0.5"
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
</div>

<!-- Agent Configuration Dialog -->
{#if onlineAgents.length > 0}
	{@const selectedAgentData = onlineAgents.find((a) => a.pubkey === selectedAgent)}
	{@const displayAgent = selectedAgentData || onlineAgents[0]}
	<AgentConfigDialog
		bind:open={configDialogOpen}
		agent={displayAgent}
		availableModels={availableModels}
		availableTools={availableTools}
		onClose={() => (configDialogOpen = false)}
		onSave={handleAgentConfigSave}
	/>
{/if}
