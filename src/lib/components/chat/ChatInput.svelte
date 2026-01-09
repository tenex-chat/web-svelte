<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import AgentConfigDialog from './AgentConfigDialog.svelte';
	import AgentSelector from './AgentSelector.svelte';
	import WorktreeSelector from './WorktreeSelector.svelte';
	import NudgeSelector from './NudgeSelector.svelte';
	import ActiveAgents from './ActiveAgents.svelte';
	import { Maximize2, Minimize2, Phone, X, Loader2 } from 'lucide-svelte';
	import { nudgeStore } from '$lib/stores/nudges.svelte';
	import { windowManager } from '$lib/stores/windowManager.svelte';
	import { draftStore } from '$lib/stores/drafts.svelte';
	import { TIMING } from '$lib/constants';
	import ReplyContextBanner from './ReplyContextBanner.svelte';
	import MentionedAgentsPills from './MentionedAgentsPills.svelte';
	import SelectedNudgesPills from './SelectedNudgesPills.svelte';
	import MentionAutocomplete from './MentionAutocomplete.svelte';
	import NudgeAutocomplete from './NudgeAutocomplete.svelte';
    import { cn } from '$lib/ndk/utils/cn';
	import { HashtagStore } from '$lib/stores/hashtags.svelte';
	import NDKBlossom from '@nostr-dev-kit/blossom';
	import ImageAttachmentPreview from './ImageAttachmentPreview.svelte';

	interface ImageAttachment {
		url: string;
		isUploading?: boolean;
		progress?: number;
	}

	interface Props {
		project?: NDKProject;
		rootEvent?: NDKEvent | null;
		onlineAgents?: ProjectAgent[];
		recentMessages?: NDKEvent[];
		onThreadCreated?: (thread: NDKEvent) => void;
		replyToEvent?: NDKEvent | null;
		quoteEvent?: NDKEvent | null;
		onCancelReply?: () => void;
		documentRef?: string;
	}

	let {
		project,
		rootEvent,
		onlineAgents = [],
		recentMessages = [],
		onThreadCreated,
		replyToEvent = null,
		quoteEvent = null,
		onCancelReply,
		documentRef
	}: Props = $props();

	const projectId = $derived(project?.tagId());
	const availableModels = $derived(projectId ? projectStatusStore.getModels(projectId) : []);
	const availableTools = $derived(projectId ? projectStatusStore.getTools(projectId) : []);
	const availableWorktrees = $derived(projectId ? projectStatusStore.getWorktrees(projectId) : []);
	const defaultWorktree = $derived(projectId ? projectStatusStore.getDefaultWorktree(projectId) : null);

	// Draft key: use conversation ID if exists, otherwise use project-level key for new threads
	const draftKey = $derived(rootEvent?.id || (projectId ? `project:${projectId}` : undefined));

	// Hashtag store for tracking conversation hashtags
	const hashtagStore = new HashtagStore(ndk);

	// Initialize hashtag store when project is available
	$effect(() => {
		if (project) {
			hashtagStore.init(project);
		}
		return () => {
			hashtagStore.destroy();
		};
	});

	let messageInput = $state('');
	let selectedAgent = $state<string | null>(null);
	let selectedHashtag = $state<string | null>(null);
	let selectedWorktree = $state<string | null>(null);
	let selectedNudges = $state<string[]>([]);
	let isSubmitting = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let configDialogOpen = $state(false);
	let agentToConfigurePubkey = $state<string | null>(null);
	let cursorPosition = $state(0);
	let mentionKeyDownHandler = $state<(e: KeyboardEvent) => boolean>(() => false);
	let nudgeKeyDownHandler = $state<(e: KeyboardEvent) => boolean>(() => false);
	let fileInputElement: HTMLInputElement | null = $state(null);
	let isUploading = $state(false);
	let uploadProgress = $state(0);
	let imageAttachments = $state<ImageAttachment[]>([]);
	let isDragOver = $state(false);

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

	// Track last save time and pending content for throttled debounce
	let lastSaveTime = $state(0);
	let pendingDraftKey = $state<string | undefined>(undefined);
	let pendingContent = $state<string>('');

	// Throttled debounce draft saving:
	// - Saves after 2 seconds of inactivity (debounce)
	// - BUT also saves at least every 5 seconds during continuous typing (throttle/maxWait)
	// - AND saves immediately on draftKey change or component unmount
	$effect(() => {
		if (!draftKey) return;

		// Track pending save data for cleanup
		pendingDraftKey = draftKey;
		pendingContent = messageInput;

		const now = Date.now();
		const timeSinceLastSave = now - lastSaveTime;
		const maxWait = 5000; // Save at least every 5 seconds during continuous typing

		// If we've exceeded maxWait, save immediately
		if (timeSinceLastSave >= maxWait && messageInput.trim()) {
			draftStore.saveDraft(draftKey, messageInput);
			lastSaveTime = Date.now();
			return;
		}

		// Otherwise, use debounce with remaining maxWait time
		const debounceDelay = TIMING.DRAFT_SAVE_DEBOUNCE;
		const remainingMaxWait = Math.max(0, maxWait - timeSinceLastSave);
		const effectiveDelay = Math.min(debounceDelay, remainingMaxWait);

		const timeoutId = setTimeout(() => {
			if (pendingDraftKey && pendingContent !== undefined) {
				draftStore.saveDraft(pendingDraftKey, pendingContent);
				lastSaveTime = Date.now();
			}
		}, effectiveDelay);

		return () => {
			clearTimeout(timeoutId);
		};
	});

	// Save draft immediately when draftKey changes (switching conversations)
	// This ensures we don't lose work when navigating away
	let previousDraftKey = $state<string | undefined>(undefined);
	$effect(() => {
		const currentKey = draftKey;

		// If draftKey changed and we had pending content for the old key, save it
		if (previousDraftKey && previousDraftKey !== currentKey && pendingContent.trim()) {
			draftStore.saveDraft(previousDraftKey, pendingContent);
		}

		previousDraftKey = currentKey;
	});

	// Emergency save on component unmount
	$effect(() => {
		return () => {
			// This runs when component is destroyed
			if (pendingDraftKey && pendingContent.trim()) {
				draftStore.saveDraft(pendingDraftKey, pendingContent);
			}
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
		return defaultWorktree ?? null;
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

	let mentionedAgents = $state<string[]>([]);

	function updateCursorPosition() {
		if (textareaElement) {
			cursorPosition = textareaElement.selectionStart;
		}
	}

	// Parse the message input to detect @mentions and update mentionedAgents
	function parseMentionsFromText(text: string): string[] {
		const mentionPattern = /@([a-zA-Z0-9_-]+)/g;
		const matches = text.matchAll(mentionPattern);
		const foundPubkeys: string[] = [];

		for (const match of matches) {
			const mentionedName = match[1];
			// Find the agent by name (case-insensitive)
			const agent = onlineAgents.find(
				(a) => a.name.toLowerCase() === mentionedName.toLowerCase()
			);
			if (agent && !foundPubkeys.includes(agent.pubkey)) {
				foundPubkeys.push(agent.pubkey);
			}
		}

		return foundPubkeys;
	}

	// SINGLE SOURCE OF TRUTH: Update mentionedAgents whenever messageInput changes
	// This ensures paste, autocomplete, and manual typing all keep mentionedAgents in sync
	$effect(() => {
		const detectedPubkeys = parseMentionsFromText(messageInput);

		// Only update if the detected mentions differ from current state
		// This prevents infinite loops and unnecessary re-renders
		const currentSet = new Set(mentionedAgents);
		const detectedSet = new Set(detectedPubkeys);

		const hasChanges =
			currentSet.size !== detectedSet.size ||
			[...currentSet].some(pk => !detectedSet.has(pk));

		if (hasChanges) {
			mentionedAgents = detectedPubkeys;

			// Auto-select single mentioned agent
			if (mentionedAgents.length === 1 && !selectedAgent) {
				selectedAgent = mentionedAgents[0];
			}
		}
	});

	// Handle mention selection from autocomplete
	// Note: mentionedAgents array is now automatically updated via the parseMentionsFromText effect
	function handleMentionSelect(agent: ProjectAgent, mention: string, startPos: number, endPos: number) {
		const before = messageInput.substring(0, startPos);
		const after = messageInput.substring(endPos);
		messageInput = before + mention + after;

		// The mentionedAgents array will be automatically updated by the $effect above
		// Just restore focus and cursor position
		setTimeout(() => {
			if (textareaElement) {
				const newCursorPos = before.length + mention.length;
				textareaElement.focus();
				textareaElement.setSelectionRange(newCursorPos, newCursorPos);
				cursorPosition = newCursorPos;
			}
		}, 0);
	}

	// Handle nudge selection from autocomplete
	function handleNudgeSelect(nudge: NDKEvent, startPos: number, endPos: number) {
		const before = messageInput.substring(0, startPos);
		const after = messageInput.substring(endPos);
		messageInput = before + after;

		if (!selectedNudges.includes(nudge.id)) {
			selectedNudges = [...selectedNudges, nudge.id];
		}

		setTimeout(() => {
			if (textareaElement) {
				textareaElement.focus();
				textareaElement.setSelectionRange(before.length, before.length);
				cursorPosition = before.length;
			}
		}, 0);
	}

	function handleRemoveMention(pubkey: string) {
		mentionedAgents = mentionedAgents.filter((p) => p !== pubkey);
	}

	function handleRemoveNudge(nudgeId: string) {
		selectedNudges = selectedNudges.filter(id => id !== nudgeId);
	}

	async function handleSend() {
		// Allow sending if there's text OR image attachments
		const hasText = messageInput.trim().length > 0;
		const hasImages = imageAttachments.some(att => !att.isUploading && att.url);
		if (!ndk || !ndk.$currentUser || (!hasText && !hasImages) || isSubmitting) return;

		// Build content: text + image URLs
		let content = messageInput.trim();

		// Append image URLs to content
		const completedImageUrls = imageAttachments
			.filter(att => !att.isUploading && att.url && !att.url.startsWith('blob:'))
			.map(att => att.url);

		if (completedImageUrls.length > 0) {
			const imageUrlsText = completedImageUrls.join(' ');
			content = content ? `${content}\n\n${imageUrlsText}` : imageUrlsText;
		}

		isSubmitting = true;
		const originalMessage = messageInput;
		const originalAttachments = [...imageAttachments];
		try {
			messageInput = ''; // Clear immediately for better UX
			imageAttachments = []; // Clear attachments

			if (!rootEvent) {
				// CREATE NEW THREAD (kind:1)
				const thread = new NDKEvent(ndk);
				thread.kind = 1;
				thread.content = content;

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

				// Add selected hashtag if present
				if (selectedHashtag) {
					thread.tags.push(['t', selectedHashtag.toLowerCase()]);
				}

				// P-TAG ROUTING for new thread
				// Only add p-tags if no hashtag is selected
				if (!selectedHashtag) {
					if (mentionedAgents.length > 1) {
						// Multiple mentions - add all as p-tags
						for (const pubkey of mentionedAgents) {
							thread.tags.push(['p', pubkey]);
						}
					} else if (currentAgent) {
						// Single source of truth: use currentAgent (handles single mention, selection, or default)
						thread.tags.push(['p', currentAgent]);
					}
				}

				// Add nudge tags
				for (const nudgeId of selectedNudges) {
					thread.tags.push(['nudge', nudgeId]);
				}

				// Add branch tag if specified
				if (currentWorktree) {
					thread.tags.push(['branch', currentWorktree]);
				}

				// Add quote tag if quoting an event
				if (quoteEvent) {
					thread.tags.push(['q', quoteEvent.id, '', quoteEvent.pubkey]);
				}

				// Add document reference if provided
				if (documentRef) {
					thread.tags.push(['a', documentRef]);
				}

				// Sign and publish
				await thread.sign(undefined, { pTags: false });
				thread.publish();

				// Notify parent
				if (onThreadCreated) {
					onThreadCreated(thread);
				}
			} else {
				// SEND REPLY (kind:1) - always e-tag the root
				const reply = new NDKEvent(ndk);
				reply.kind = 1;
				reply.content = content;
				reply.tags = [['e', rootEvent.id]]; // Always e-tag the root (OP)

				// Add project reference
				if (project) {
					const tagId = project.tagId();
					if (tagId) {
						reply.tags.push(['a', tagId]);
					}
				}

				// If replying to a specific message, add p-tag for that author
				if (replyToEvent) {
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

				// Add quote tag if quoting an event
				if (quoteEvent) {
					reply.tags.push(['q', quoteEvent.id, '', quoteEvent.pubkey]);
				}

				// Sign and publish
				await reply.sign(undefined, { pTags: false });
				reply.publish();
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
			messageInput = originalMessage; // Restore message on error
			imageAttachments = originalAttachments; // Restore attachments on error
		} finally {
			isSubmitting = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Toggle expand/collapse with Cmd+Shift+E (Mac) or Ctrl+Shift+E (Windows/Linux)
		if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
			e.preventDefault();
			handleToggleExpand();
			return;
		}

		// Handle nudge autocomplete first
		if (nudgeKeyDownHandler(e)) {
			return;
		}

		// Handle mention autocomplete
		if (mentionKeyDownHandler(e)) {
			return;
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

	// Handle file attachment button click
	function handleAttachClick() {
		fileInputElement?.click();
	}

	// Handle file selection and upload to Blossom
	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;

		if (!files || files.length === 0 || !ndk || !ndk.$currentUser) {
			return;
		}

		// Process all selected image files
		for (const file of Array.from(files)) {
			if (file.type.startsWith('image/')) {
				await uploadFile(file);
			}
		}

		// Reset file input so same file can be selected again
		if (input) {
			input.value = '';
		}
	}

	// Handle removing an image attachment
	function handleRemoveAttachment(index: number) {
		const attachment = imageAttachments[index];
		// Revoke blob URL if it's a local file
		if (attachment.url.startsWith('blob:')) {
			URL.revokeObjectURL(attachment.url);
		}
		imageAttachments = imageAttachments.filter((_, idx) => idx !== index);
	}

	// Handle drag and drop events
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		// Only show drag state if we have image files
		if (e.dataTransfer?.types.includes('Files')) {
			isDragOver = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		// Only reset if we're leaving the container (not entering a child)
		const relatedTarget = e.relatedTarget as Node | null;
		const currentTarget = e.currentTarget as Node;
		if (!currentTarget.contains(relatedTarget)) {
			isDragOver = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	async function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragOver = false;

		const files = e.dataTransfer?.files;
		if (!files || files.length === 0 || !ndk || !ndk.$currentUser) {
			return;
		}

		// Process all image files from the drop
		for (const file of Array.from(files)) {
			if (file.type.startsWith('image/')) {
				await uploadFile(file);
			}
		}
	}

	// Shared upload logic for both file select and drag-drop
	async function uploadFile(file: File) {
		if (!ndk || !ndk.$currentUser) return;

		isUploading = true;
		uploadProgress = 0;

		// Add a placeholder attachment showing upload progress
		const placeholderUrl = URL.createObjectURL(file);
		const attachmentIndex = imageAttachments.length;
		imageAttachments = [...imageAttachments, {
			url: placeholderUrl,
			isUploading: true,
			progress: 0
		}];

		try {
			const blossom = new NDKBlossom(ndk);

			// Track upload progress
			blossom.onUploadProgress = (progress) => {
				const progressPercent = Math.round((progress.loaded / progress.total) * 100);
				uploadProgress = progressPercent;
				// Update the attachment progress
				imageAttachments = imageAttachments.map((att, idx) =>
					idx === attachmentIndex ? { ...att, progress: progressPercent } : att
				);
				return 'continue';
			};

			// Handle upload errors
			blossom.onUploadFailed = (error, serverUrl) => {
				console.error('Upload failed:', error, 'on server:', serverUrl);
			};

			// Upload to blossom.primal.net by default
			const imeta = await blossom.upload(file, {
				server: 'https://blossom.primal.net'
			});

			// Update the attachment with the final URL
			if (imeta.url) {
				const finalUrl = imeta.url;
				// Revoke the blob URL
				URL.revokeObjectURL(placeholderUrl);

				// Update attachment with real URL
				imageAttachments = imageAttachments.map((att, idx) =>
					idx === attachmentIndex ? { url: finalUrl, isUploading: false, progress: 100 } : att
				);
			}
		} catch (error) {
			console.error('Failed to upload file:', error);
			// Remove the failed attachment
			URL.revokeObjectURL(placeholderUrl);
			imageAttachments = imageAttachments.filter((_, idx) => idx !== attachmentIndex);
		} finally {
			isUploading = false;
			uploadProgress = 0;
		}
	}

</script>

<div class="p-4">
	<!-- Reply/Quote Context -->
	<ReplyContextBanner {replyToEvent} {quoteEvent} onCancel={onCancelReply} />

	<!-- Glassy Input Container -->
	<div
		class={cn(
			"relative rounded-2xl bg-card/40 backdrop-blur-xl border shadow-sm hover:shadow-md transition-all duration-200",
			isDragOver
				? "border-primary border-2 bg-primary/5"
				: "border-border/50"
		)}
		ondragenter={handleDragEnter}
		ondragleave={handleDragLeave}
		ondragover={handleDragOver}
		ondrop={handleDrop}
		role="region"
		aria-label="Drop images here to attach"
	>
		<!-- Drag Overlay -->
		{#if isDragOver}
			<div class="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-2xl z-10 pointer-events-none">
				<div class="flex flex-col items-center gap-2 text-primary">
					<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
					</svg>
					<span class="text-sm font-medium">Drop images here</span>
				</div>
			</div>
		{/if}
		<div class="flex flex-col p-3">
			<!-- Image Attachments Preview -->
			{#if imageAttachments.length > 0}
				<ImageAttachmentPreview
					attachments={imageAttachments}
					onRemove={handleRemoveAttachment}
				/>
			{/if}

			<!-- Textarea -->
			<div class="flex-1 relative">
				<textarea
					bind:this={textareaElement}
					bind:value={messageInput}
					oninput={updateCursorPosition}
					onclick={updateCursorPosition}
					onkeydown={handleKeyDown}
					placeholder={isExpanded
						? (rootEvent ? 'Type a message... (Cmd+Enter to send)' : 'Start a new conversation... (Cmd+Enter to send)')
						: (rootEvent ? 'Type a message...' : 'Start a new conversation...')}
					disabled={isSubmitting || !ndk.$currentUser}
					class={cn(
						"w-full bg-transparent text-foreground rounded-lg resize-none focus:outline-none disabled:cursor-not-allowed placeholder:text-muted-foreground transition-all duration-300",
						'h-12',
						isExpanded ? 'font-mono' : ''
					)}
					rows={isExpanded ? 30 : 1}
					style={isExpanded ? 'max-height: 60vh; min-height: 400px;' : ''}
				></textarea>

				<!-- Nudge Autocomplete -->
				<NudgeAutocomplete
					{messageInput}
					{cursorPosition}
					{selectedNudges}
					onSelectNudge={handleNudgeSelect}
					bind:onKeyDown={nudgeKeyDownHandler}
				/>

				<!-- Mention Autocomplete -->
				<MentionAutocomplete
					{messageInput}
					{cursorPosition}
					{onlineAgents}
					onSelectMention={handleMentionSelect}
					bind:onKeyDown={mentionKeyDownHandler}
				/>
			</div>

			<!-- Controls Row: Agent Selector, Active Agents, Attachment -->
			<div class="flex items-center justify-between gap-2 pt-2">
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
							selectedHashtag={selectedHashtag}
							defaultAgent={defaultAgent}
							currentModel={currentAgentModel}
							hashtags={hashtagStore.tags}
							onSelect={(pubkey) => (selectedAgent = pubkey)}
							onSelectHashtag={(hashtag) => (selectedHashtag = hashtag)}
							onConfigure={(pubkey) => {
								agentToConfigurePubkey = pubkey;
								configDialogOpen = true;
							}}
							onClose={() => textareaElement?.focus()}
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
					<input
						bind:this={fileInputElement}
						type="file"
						accept="image/*"
						multiple
						class="hidden"
						onchange={handleFileSelect}
					/>
					<button
						onclick={handleAttachClick}
						class="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground relative"
						type="button"
						title={isUploading ? `Uploading... ${uploadProgress}%` : "Attach image"}
						aria-label={isUploading ? "Uploading image" : "Attach image"}
						disabled={isUploading || isSubmitting || !ndk.$currentUser}
					>
						{#if isUploading}
							<Loader2 class="w-5 h-5 animate-spin" />
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
								/>
							</svg>
						{/if}
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

	<!-- Mentioned Agents Indicator -->
	<MentionedAgentsPills {mentionedAgents} {onlineAgents} onRemoveMention={handleRemoveMention} />

	<!-- Selected Nudges Indicator -->
	<SelectedNudgesPills {selectedNudges} onRemoveNudge={handleRemoveNudge} />
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
