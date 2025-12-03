<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKThread, NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { User } from '$lib/ndk/ui/user';
	import AgentConfigDialog from './AgentConfigDialog.svelte';
	import AgentSelector from './AgentSelector.svelte';
	import WorktreeSelector from './WorktreeSelector.svelte';
	import NudgeSelector from './NudgeSelector.svelte';
	import ActiveAgents from './ActiveAgents.svelte';
	import NudgeAutocompleteItem from './NudgeAutocompleteItem.svelte';
	import { Maximize2, Minimize2, Phone, X } from 'lucide-svelte';
	import { nudgeStore } from '$lib/stores/nudges.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { draftStore } from '$lib/stores/drafts.svelte';
	import { TIMING } from '$lib/constants';

	interface Props {
		project?: NDKProject;
		rootEvent?: NDKEvent | null;
		onlineAgents?: ProjectAgent[];
		recentMessages?: NDKEvent[];
		onThreadCreated?: (thread: NDKEvent) => void;
		replyToEvent?: NDKEvent | null;
		onCancelReply?: () => void;
		initialContent?: string;
	}

	let {
		project,
		rootEvent,
		onlineAgents = [],
		recentMessages = [],
		onThreadCreated,
		replyToEvent = null,
		onCancelReply,
		initialContent = ''
	}: Props = $props();

	const projectId = $derived(project?.tagId());
	const availableModels = $derived(projectId ? projectStatusStore.getModels(projectId) : []);
	const availableTools = $derived(projectId ? projectStatusStore.getTools(projectId) : []);
	const availableWorktrees = $derived(projectId ? projectStatusStore.getWorktrees(projectId) : []);
	const defaultWorktree = $derived(projectId ? projectStatusStore.getDefaultWorktree(projectId) : null);

	// Draft key: use conversation ID if exists, otherwise use project-level key for new threads
	const draftKey = $derived(rootEvent?.id || (projectId ? `project:${projectId}` : undefined));

	let messageInput = $state('');
	let selectedAgent = $state<string | null>(null);
	let selectedWorktree = $state<string | null>(null);
	let selectedNudges = $state<string[]>([]);
	let isSubmitting = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let configDialogOpen = $state(false);
	let agentToConfigurePubkey = $state<string | null>(null);

	// Clean up agent configuration state when dialog closes
	$effect(() => {
		if (!configDialogOpen) {
			agentToConfigurePubkey = null;
		}
	});
	let isExpanded = $state(false);
	let hasManuallyToggled = $state(false);

	// Load draft when conversation or project changes
	$effect(() => {
		if (draftKey) {
			const draft = draftStore.getDraft(draftKey);
			messageInput = draft || '';
		} else if (initialContent) {
			messageInput = initialContent;
		} else {
			messageInput = '';
		}
	});

	// Load selected nudges from localStorage based on conversation
	$effect(() => {
		const conversationId = rootEvent?.id;
		if (conversationId && typeof window !== 'undefined') {
			const storageKey = `nudges_${conversationId}`;
			const stored = localStorage.getItem(storageKey);
			if (stored) {
				try {
					selectedNudges = JSON.parse(stored);
				} catch {
					selectedNudges = [];
				}
			}
		}
	});

	// Save selected nudges to localStorage when they change
	$effect(() => {
		const conversationId = rootEvent?.id;
		if (conversationId && typeof window !== 'undefined') {
			const storageKey = `nudges_${conversationId}`;
			localStorage.setItem(storageKey, JSON.stringify(selectedNudges));
		}
	});

	// Load nudges on mount
	$effect(() => {
		nudgeStore.loadNudges();
	});

	// Autofocus on mount
	$effect(() => {
		if (textareaElement) {
			textareaElement.focus();
		}
	});

	// Auto-expand when text exceeds 300 characters (unless user manually toggled)
	$effect(() => {
		if (!hasManuallyToggled && messageInput.length > 300 && !isExpanded) {
			isExpanded = true;
		}
	});

	// Debounced draft saving
	$effect(() => {
		if (!draftKey) return;

		const timeoutId = setTimeout(() => {
			draftStore.saveDraft(draftKey, messageInput);
		}, TIMING.DRAFT_SAVE_DEBOUNCE);

		return () => {
			clearTimeout(timeoutId);
		};
	});

	// Compute default agent based on recent messages (SINGLE SOURCE OF TRUTH)
	const defaultAgent = $derived.by(() => {
		if (onlineAgents.length === 0) return null;

		// If there are recent messages, find the most recent agent message
		if (recentMessages.length > 0) {
			const recentAgent = [...recentMessages].reverse().find((msg) => {
				return onlineAgents.find((a) => a.pubkey === msg.pubkey);
			});

			if (recentAgent) {
				return recentAgent.pubkey;
			}
		}

		// Otherwise, default to the PM (first agent)
		return onlineAgents[0].pubkey;
	});

	// Compute default worktree based on recent messages (follows agent selector pattern)
	const defaultWorktreeFromMessages = $derived.by(() => {
		if (availableWorktrees.length === 0) return null;

		// If there are recent messages, find the most recent branch tag
		if (recentMessages.length > 0) {
			const recentWorktree = [...recentMessages].reverse().find((msg) => {
				const branchTag = msg.tags.find((tag) => tag[0] === 'branch' && tag[1]);
				return branchTag !== undefined;
			});

			if (recentWorktree) {
				const branchTag = recentWorktree.tags.find((tag) => tag[0] === 'branch' && tag[1]);
				return branchTag?.[1] || null;
			}
		}

		// Otherwise, default to the first worktree (default branch)
		return defaultWorktree;
	});

	// Derive the current worktree (selected takes precedence, then derived default)
	const currentWorktree = $derived(selectedWorktree || defaultWorktreeFromMessages);

	// Derive the current agent (mentioned agent takes precedence, then selected, then default)
	const currentAgent = $derived.by(() => {
		// If there's exactly one mentioned agent, use that
		if (mentionedAgents.length === 1) {
			return mentionedAgents[0];
		}
		// Otherwise use selected agent or computed default
		return selectedAgent || defaultAgent;
	});


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

	// Nudge autocomplete state
	let showNudgeAutocomplete = $state(false);
	let nudgeQuery = $state('');
	let nudgeStartPos = $state(0);
	let selectedNudgeIndex = $state(0);

	// Filter agents for autocomplete
	const filteredAgents = $derived.by(() => {
		if (!showMentionAutocomplete) return [];
		const query = mentionQuery.toLowerCase();
		return onlineAgents.filter((agent) => agent.name.toLowerCase().includes(query));
	});

	// Filter nudges for autocomplete (user's own nudges + saved nudges)
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

	// Detect @ mentions and / nudges and update autocomplete
	function handleInput() {
		if (!textareaElement) return;

		const cursorPos = textareaElement.selectionStart;
		const textBeforeCursor = messageInput.substring(0, cursorPos);

		// Check for / nudge autocomplete first
		const lastSlashIndex = textBeforeCursor.lastIndexOf('/');
		if (lastSlashIndex !== -1) {
			const charBeforeSlash = lastSlashIndex > 0 ? textBeforeCursor[lastSlashIndex - 1] : ' ';
			const isAtWordBoundary = /\s/.test(charBeforeSlash) || lastSlashIndex === 0;
			const textAfterSlash = textBeforeCursor.substring(lastSlashIndex + 1);
			const hasNoSpace = !textAfterSlash.includes(' ');

			if (isAtWordBoundary && hasNoSpace) {
				showNudgeAutocomplete = true;
				nudgeQuery = textAfterSlash;
				nudgeStartPos = lastSlashIndex;
				selectedNudgeIndex = 0;
				showMentionAutocomplete = false;
				return;
			}
		}

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
				showNudgeAutocomplete = false;
				return;
			}
		}

		// Hide autocomplete
		showMentionAutocomplete = false;
		showNudgeAutocomplete = false;
		mentionQuery = '';
		nudgeQuery = '';
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

			// Update selected agent to the mentioned agent (for UI display)
			// If there's exactly one mention, show that agent in the selector
			if (mentionedAgents.length === 1) {
				selectedAgent = agent.pubkey;
			}
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

	// Insert nudge selection
	function selectNudge(nudge: NDKEvent) {
		const before = messageInput.substring(0, nudgeStartPos);
		const after = messageInput.substring(textareaElement?.selectionStart || 0);

		// Remove the /command text from input
		messageInput = before + after;

		// Toggle nudge in selectedNudges
		if (!selectedNudges.includes(nudge.id)) {
			selectedNudges = [...selectedNudges, nudge.id];
		}

		// Hide autocomplete
		showNudgeAutocomplete = false;
		nudgeQuery = '';

		// Focus and set cursor
		setTimeout(() => {
			if (textareaElement) {
				textareaElement.focus();
				textareaElement.setSelectionRange(before.length, before.length);
			}
		}, 0);
	}

	function removeNudge(nudgeId: string) {
		selectedNudges = selectedNudges.filter(id => id !== nudgeId);
	}

	async function handleSend() {
		if (!ndk || !ndk.$currentUser || !messageInput.trim() || isSubmitting) return;

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

				// P-TAG ROUTING for new thread
				if (mentionedAgents.length > 1) {
					// Multiple mentions - add all as p-tags
					for (const pubkey of mentionedAgents) {
						thread.tags.push(['p', pubkey]);
					}
				} else if (currentAgent) {
					// Single source of truth: use currentAgent (handles single mention, selection, or default)
					thread.tags.push(['p', currentAgent]);
				}

				// Add nudge tags
				for (const nudgeId of selectedNudges) {
					thread.tags.push(['nudge', nudgeId]);
				}

				// Add branch tag if specified
				if (currentWorktree) {
					thread.tags.push(['branch', currentWorktree]);
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

				// P-TAG ROUTING for reply
				if (mentionedAgents.length > 1) {
					// Multiple mentions - add all as p-tags
					for (const pubkey of mentionedAgents) {
						reply.tags.push(['p', pubkey]);
					}
				} else if (currentAgent) {
					// Single source of truth: use currentAgent (handles single mention, selection, or default)
					reply.tags.push(['p', currentAgent]);
				}

				// Add nudge tags
				for (const nudgeId of selectedNudges) {
					reply.tags.push(['nudge', nudgeId]);
				}

				// Add branch tag if specified
				if (currentWorktree) {
					reply.tags.push(['branch', currentWorktree]);
				}

				// Sign and publish
				await reply.sign(undefined, { pTags: false });
				await reply.publish();
			}

			// Clear draft
			draftStore.clearDraft(draftKey);

			// Reset state
			selectedAgent = null;
			selectedWorktree = null;
			mentionedAgents = [];
			// Reset expansion state after sending
			isExpanded = false;
			hasManuallyToggled = false;
			// Clear reply context
			if (onCancelReply) {
				onCancelReply();
			}

			// Restore focus to input
			setTimeout(() => {
				textareaElement?.focus();
			}, 0);
		} catch (error) {
			console.error('Failed to send message:', error);
			messageInput = content; // Restore message on error
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Handle nudge autocomplete navigation
		if (showNudgeAutocomplete && filteredNudges.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedNudgeIndex = (selectedNudgeIndex + 1) % filteredNudges.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedNudgeIndex =
					selectedNudgeIndex === 0 ? filteredNudges.length - 1 : selectedNudgeIndex - 1;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				selectNudge(filteredNudges[selectedNudgeIndex]);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showNudgeAutocomplete = false;
				return;
			}
		}

		// Handle mention autocomplete navigation
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

		// In expanded mode: Cmd/Ctrl+Enter sends, Enter adds new line
		// In normal mode: Enter sends, Shift+Enter adds new line
		if (e.key === 'Enter') {
			const isCmdOrCtrlEnter = e.metaKey || e.ctrlKey;

			if (isExpanded) {
				// Expanded mode: Cmd/Ctrl+Enter to send
				if (isCmdOrCtrlEnter) {
					e.preventDefault();
					handleSend();
				}
				// Regular Enter just adds a new line (default behavior)
			} else {
				// Normal mode: Enter to send (unless Shift is held)
				if (!e.shiftKey) {
					e.preventDefault();
					handleSend();
				}
			}
		}
	}

	// Handle the expand/collapse toggle
	function handleToggleExpand() {
		isExpanded = !isExpanded;
		hasManuallyToggled = true;
	}

	// Handle starting a voice call
	function handleStartCall() {
		if (project) {
			windowManager.openCall(project, rootEvent ?? undefined);
		}
	}

</script>

<div class="p-4">
	<!-- Reply Context -->
	{#if replyToEvent}
		<div class="mb-3 px-3 py-2 bg-blue-50/50 backdrop-blur-sm border-l-4 border-blue-500 rounded-lg flex items-center gap-2">
			<svg class="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
				/>
			</svg>
			<div class="flex-1 min-w-0">
				<User.Root {ndk} pubkey={replyToEvent.pubkey}>
					<div class="text-xs text-primary font-medium">Replying to <User.Name /></div>
				</User.Root>
				<div class="text-xs text-blue-800 truncate">
					{replyToEvent.content.slice(0, 100)}{replyToEvent.content.length > 100 ? '...' : ''}
				</div>
			</div>
			<button
				type="button"
				onclick={onCancelReply}
				class="p-1 rounded hover:bg-blue-100/50 transition-colors text-primary"
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

	<!-- Glassy Input Container -->
	<div class="relative rounded-2xl bg-card/40 backdrop-blur-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-200">
		<div class="flex flex-col p-3">
			<!-- Textarea -->
			<div class="flex-1 relative">
				<textarea
					bind:this={textareaElement}
					bind:value={messageInput}
					oninput={handleInput}
					onkeydown={handleKeyDown}
					placeholder={isExpanded
						? (rootEvent ? 'Type a message... (Cmd+Enter to send)' : 'Start a new conversation... (Cmd+Enter to send)')
						: (rootEvent ? 'Type a message...' : 'Start a new conversation...')}
					disabled={isSubmitting || !ndk.$currentUser}
					class="w-full bg-transparent text-foreground rounded-lg resize-none focus:outline-none disabled:cursor-not-allowed placeholder:text-muted-foreground transition-all duration-200"
					rows={isExpanded ? 30 : 1}
					style={isExpanded ? 'font-family: monospace; max-height: 60vh;' : ''}
				></textarea>

				<!-- /nudge Autocomplete Dropdown -->
				{#if showNudgeAutocomplete && filteredNudges.length > 0}
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

				<!-- @mention Autocomplete Dropdown -->
				{#if showMentionAutocomplete && filteredAgents.length > 0}
					<div
						class="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-popover/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-lg overflow-hidden z-50"
					>
						<div class="max-h-48 overflow-y-auto">
							{#each filteredAgents as agent, index (agent.pubkey)}
								<button
									type="button"
									onclick={() => selectMention(agent)}
									onmouseenter={() => (selectedMentionIndex = index)}
									class="w-full px-3 py-2 text-left hover:bg-blue-50/50 transition-colors {index ===
									selectedMentionIndex
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
			</div>

			<!-- Controls Row: Agent Selector, Active Agents, Attachment -->
			<div class="flex items-center justify-between gap-2 border-t border-border/30 pt-2">
				<!-- Left side controls -->
				<div class="flex items-center gap-2">
					<!-- Nudge Selector -->
					<NudgeSelector
						bind:selectedNudges
						onSelectionChange={(newSelection) => (selectedNudges = newSelection)}
					/>

					<!-- Agent Selector -->
					{#if onlineAgents.length > 0}
						<AgentSelector
							agents={onlineAgents}
							selectedAgent={selectedAgent}
							defaultAgent={defaultAgent}
							currentModel={currentAgentModel}
							onSelect={(pubkey) => (selectedAgent = pubkey)}
							onConfigure={(pubkey) => {
								agentToConfigurePubkey = pubkey;
								configDialogOpen = true;
							}}
						/>
					{/if}

					<!-- Worktree Selector -->
					{#if availableWorktrees.length > 0}
						<WorktreeSelector
							worktrees={availableWorktrees}
							selectedWorktree={selectedWorktree}
							defaultWorktree={defaultWorktreeFromMessages}
							onSelect={(branch) => (selectedWorktree = branch)}
						/>
					{/if}

					<!-- Voice Call Button -->
					<button
						onclick={handleStartCall}
						class="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
						type="button"
						title="Start voice call"
						aria-label="Start voice call"
					>
						<Phone class="w-5 h-5" />
					</button>

					<!-- Attachment Button -->
					<button
						class="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
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

					<!-- Expand/Collapse Toggle Button -->
					<button
						onclick={handleToggleExpand}
						class="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
						type="button"
						title={isExpanded ? 'Shrink input (Cmd+Enter to send)' : 'Expand input (Enter for new lines)'}
						aria-label={isExpanded ? 'Shrink input' : 'Expand input'}
						disabled={isSubmitting || !ndk.$currentUser}
					>
						{#if isExpanded}
							<Minimize2 class="w-5 h-5" />
						{:else}
							<Maximize2 class="w-5 h-5" />
						{/if}
					</button>
				</div>

				<!-- Right side - Active Agents -->
				<ActiveAgents
					eventId={rootEvent?.id}
					projectId={projectId}
					onlineAgents={onlineAgents}
				/>
			</div>
		</div>
	</div>

	<!-- Mentioned Agents Indicator (only show when multiple agents mentioned) -->
	{#if mentionedAgents.length > 1}
		<div class="mt-3 flex items-center gap-2 flex-wrap">
			<span class="text-xs text-muted-foreground">Mentioning:</span>
			{#each mentionedAgents as pubkey (pubkey)}
				{@const agent = onlineAgents.find((a) => a.pubkey === pubkey)}
				{#if agent}
					<span
						class="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100/50 backdrop-blur-sm text-blue-800 rounded-full text-xs"
					>
						<span>@{agent.name}</span>
						<button
							type="button"
							onclick={() => {
								mentionedAgents = mentionedAgents.filter((p) => p !== pubkey);
							}}
							class="hover:bg-blue-200/50 rounded-full p-0.5"
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

	<!-- Selected Nudges Indicator -->
	{#if selectedNudges.length > 0}
		<div class="mt-3 flex items-center gap-2 flex-wrap">
			<span class="text-xs text-muted-foreground">Nudges:</span>
			{#each selectedNudges as nudgeId (nudgeId)}
				{@const nudge = nudgeStore.nudges.find((n) => n.id === nudgeId)}
				{#if nudge}
					{@const title = nudge.tagValue('title') || 'Untitled'}
					<span
						class="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 backdrop-blur-sm text-primary rounded-full text-xs"
					>
						<span>/{title}</span>
						<button
							type="button"
							onclick={() => removeNudge(nudgeId)}
							class="hover:bg-primary/20 rounded-full p-0.5"
							aria-label="Remove nudge"
						>
							<X class="w-3 h-3" />
						</button>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- Agent Configuration Dialog -->
{#if project && onlineAgents.length > 0 && agentToConfigurePubkey}
	{@const agentToConfig = onlineAgents.find((a) => a.pubkey === agentToConfigurePubkey)}
	{#if agentToConfig}
		<AgentConfigDialog
			bind:open={configDialogOpen}
			{project}
			agent={agentToConfig}
			availableModels={availableModels}
			availableTools={availableTools}
		/>
	{/if}
{/if}
