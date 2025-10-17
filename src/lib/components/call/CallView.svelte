<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKThread, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { processEventsToMessages } from '$lib/utils/messageProcessor';
	import { streamingMessageStore } from '$lib/utils/streamingMessageStore.svelte';
	import { EVENT_KINDS } from '$lib/constants';
	import { CallStore, type CallStoreOptions, type CallState } from '$lib/stores/call-store.svelte';
	import VoiceVisualizer from './VoiceVisualizer.svelte';
	import AudioControls from './AudioControls.svelte';
	import CallStatus from './CallStatus.svelte';
	import AgentSelector from '../chat/AgentSelector.svelte';
	import AgentAvatar from './AgentAvatar.svelte';

	interface Props {
		project: NDKProject;
		onClose: (rootEvent?: NDKEvent | null) => void;
		extraTags?: string[][];
		rootEvent?: NDKEvent | null;
		isEmbedded?: boolean;
	}

	let {
		project,
		onClose,
		extraTags,
		rootEvent: initialRootEvent,
		isEmbedded = false
	}: Props = $props();

	// Get current user from NDK session
	const currentUser = $derived(ndk.$sessions.currentUser);

	// Get project ID for status lookups
	const projectId = $derived(project?.tagId());

	// Get online agents for this project
	const onlineAgents = $derived(projectId ? projectStatusStore.getOnlineAgents(projectId) : []);

	// Local thread state
	let localRootEvent = $state<NDKEvent | null>(initialRootEvent);
	let selectedAgentPubkey: string | null = $state(null);

	// Compute default agent based on recent messages (same logic as ChatInput)
	const defaultAgent = $derived.by(() => {
		if (onlineAgents.length === 0) return null;

		// If there are recent messages, find the most recent agent message
		if (messages.length > 0) {
			const recentAgent = [...messages].reverse().find((msg) => {
				return onlineAgents.find((a) => a.pubkey === msg.event.pubkey);
			});

			if (recentAgent) {
				return recentAgent.event.pubkey;
			}
		}

		// Otherwise, default to the PM (first agent)
		return onlineAgents[0].pubkey;
	});

	// Derive active agent for display
	const activeProjectAgent = $derived(
		selectedAgentPubkey
			? onlineAgents.find((a) => a.pubkey === selectedAgentPubkey) || onlineAgents[0]
			: onlineAgents.find((a) => a.pubkey === defaultAgent) || onlineAgents[0]
	);

	// Convert to AgentInstance format for MessagingController
	const activeAgent = $derived.by(() => {
		if (!activeProjectAgent) return undefined;

		return {
			pubkey: activeProjectAgent.pubkey,
			slug: activeProjectAgent.name
		};
	});

	// Subscribe to messages in the thread
	// Need to explicitly include kind 21111 for streaming responses
	const messagesSubscription = ndk.$subscribe(() =>
		localRootEvent ? {
			filters: [
				{ kinds: [11, 1111, 7, 21111, 513], ...localRootEvent.filter() },
				{ kinds: [11, 1111, 7, 21111, 513], ...localRootEvent.nip22Filter() }
			],
			closeOnEose: false,
			bufferMs: 30
		} : false
	);

	// Track processed events to avoid reprocessing
	let processedStreamingEvents = new Set<string>();
	let processedFinalEvents = new Set<string>();

	// Process streaming events separately for immediate updates
	$effect(() => {
		const streamingEvents = messagesSubscription.events.filter(e => e.kind === EVENT_KINDS.STREAMING_RESPONSE);

		// Process only new streaming events
		for (const event of streamingEvents) {
			if (!processedStreamingEvents.has(event.id)) {
				streamingMessageStore.processStreamingEvent(event);
				processedStreamingEvents.add(event.id);
			}
		}

		// Clear sessions when final messages arrive
		const finalMessages = messagesSubscription.events.filter(e => e.kind === NDKKind.GenericReply);
		for (const event of finalMessages) {
			if (!processedFinalEvents.has(event.id)) {
				streamingMessageStore.clearSession(event.pubkey);
				processedFinalEvents.add(event.id);
				// Also clear the streaming events for this pubkey from our tracking
				streamingEvents
					.filter(e => e.pubkey === event.pubkey)
					.forEach(e => processedStreamingEvents.delete(e.id));
			}
		}
	});

	// Process messages for TTS queue
	const messages = $derived.by(() => {
		if (!localRootEvent) return [];

		const allEvents = messagesSubscription.events.some(e => e.id === localRootEvent.id)
			? messagesSubscription.events
			: [localRootEvent, ...messagesSubscription.events];

		// Filter out streaming events - we handle them separately via the global store
		// Also filter out typing indicators as they're handled by streaming store
		const nonStreamingEvents = allEvents.filter(e =>
			e.kind !== EVENT_KINDS.STREAMING_RESPONSE &&
			e.kind !== EVENT_KINDS.TYPING_INDICATOR &&
			e.kind !== EVENT_KINDS.TYPING_INDICATOR_STOP
		);

		// Get base messages - processEventsToMessages will NOT handle streaming
		// since we filtered them out above
		const baseMessages = processEventsToMessages(
			nonStreamingEvents,
			localRootEvent,
			'flattened',
			false, // not brainstorm
			false, // showAll
			currentUser?.pubkey
		);

		// Add active streaming sessions as synthetic messages from the GLOBAL store
		const streamingSessions = streamingMessageStore.getAllSessions();
		const streamingMessages = [];

		streamingSessions.forEach(([key, session]) => {
			// Create synthetic event for the streaming message
			const syntheticEvent = new NDKEvent(ndk);
			syntheticEvent.kind = EVENT_KINDS.STREAMING_RESPONSE;
			syntheticEvent.pubkey = session.latestEvent.pubkey;
			syntheticEvent.created_at = session.latestEvent.created_at;
			syntheticEvent.tags = session.latestEvent.tags;
			syntheticEvent.content = session.reconstructedContent;
			syntheticEvent.id = session.latestEvent.id;
			syntheticEvent.sig = session.latestEvent.sig;

			streamingMessages.push({
				id: session.syntheticId,
				event: syntheticEvent
			});
		});

		// Combine and sort all messages
		const allMessages = [...baseMessages, ...streamingMessages].sort((a, b) => {
			const timeA = a.event.created_at || 0;
			const timeB = b.event.created_at || 0;
			return timeA - timeB;
		});

		return allMessages;
	});

	// Thread management functions matching MessagingController interface
	async function createThread(
		content: string,
		_mentions: any[], // mentions handled by agent selection
		_images: any[], // not used in voice mode
		_autoTTS: boolean, // always true for voice mode
		selectedAgent: string | null
	): Promise<NDKEvent | null> {
		const thread = new NDKThread(ndk);
		thread.content = content;
		thread.title = content.slice(0, 50);

		// Add project reference
		const projectRef = project.tagReference();
		thread.tags.push(projectRef);

		// Add voice mode tag
		thread.tags.push(['mode', 'voice']);

		// Add p-tag for selected or active agent
		const targetAgent = selectedAgent || activeAgent?.pubkey;
		if (targetAgent) {
			thread.tags.push(['p', targetAgent]);
		} else if (onlineAgents.length > 0) {
			thread.tags.push(['p', onlineAgents[0].pubkey]);
		}

		// Add extra tags if provided
		if (extraTags) {
			thread.tags.push(...extraTags);
		}

		await thread.sign(undefined, { pTags: false });
		await thread.publish();

		localRootEvent = thread;
		return thread;
	}

	async function sendReply(
		content: string,
		_mentions: any[], // mentions handled by agent selection
		_images: any[], // not used in voice mode
		_autoTTS: boolean, // always true for voice mode
		_messages: any[], // not needed for simple reply
		selectedAgent: string | null
	): Promise<NDKEvent | null> {
		if (!localRootEvent) {
			return createThread(content, _mentions, _images, _autoTTS, selectedAgent);
		}

		const reply = localRootEvent.reply();
		reply.content = content;

		// Remove auto p-tags
		reply.tags = reply.tags.filter((tag) => tag[0] !== 'p');

		// Add project reference
		const tagId = project.tagId();
		if (tagId) {
			reply.tags.push(['a', tagId]);
		}

		// Add voice mode tag
		reply.tags.push(['mode', 'voice']);

		// Add p-tag for selected or active agent
		const targetAgent = selectedAgent || activeAgent?.pubkey;
		if (targetAgent) {
			reply.tags.push(['p', targetAgent]);
		} else if (onlineAgents.length > 0) {
			reply.tags.push(['p', onlineAgents[0].pubkey]);
		}

		// Add extra tags if provided
		if (extraTags) {
			reply.tags.push(...extraTags);
		}

		await reply.sign(undefined, { pTags: false });
		await reply.publish();

		return reply;
	}

	const threadManagement = $derived({
		localRootEvent,
		createThread,
		sendReply
	});

	// Initialize CallStore
	let callStore: CallStore | null = $state(null);

	// Local state for UI
	let callState: CallState = $state('initializing');
	let vadModeDisplay = $derived(
		callStore
			? callStore.vad.options.enabled
				? 'Auto-detect'
				: 'Push-to-talk'
			: 'Manual'
	);

	// Initialize call store on mount
	onMount(async () => {
		try {
			// Create CallStore with options
			const options: CallStoreOptions = {
				threadManagement,
				messages,
				userPubkey: currentUser?.pubkey,
				activeAgent,
				onStateChange: (state) => {
					callState = state;
				}
			};

			callStore = new CallStore(options);

			// Initialize the call
			await callStore.initialize();

			console.log('[CallView] Call initialized successfully');
		} catch (error) {
			console.error('[CallView] Failed to initialize call:', error);
		}
	});

	// Cleanup on unmount
	onDestroy(() => {
		if (callStore) {
			console.log('[CallView] Cleaning up CallStore');
			callStore.destroy();
		}
	});

	// Generate deterministic color from project
	function getProjectColor(project: any): string {
		const dTag = project.dTag || project.id || project.title || '';
		if (!dTag) return '#94a3b8';

		let hash = 0;
		for (let i = 0; i < dTag.length; i++) {
			const char = dTag.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 65%, 55%)`;
	}

	// Handle microphone toggle
	async function handleMicToggle() {
		if (!callStore) return;
		await callStore.toggleMicrophone();
	}

	// Handle send message
	async function handleSend() {
		if (!callStore) return;

		const text = callStore.transcript;
		if (!text.trim()) return;

		try {
			await callStore.sendMessage(text);
		} catch (error) {
			console.error('[CallView] Failed to send message:', error);
			// TODO: Show toast notification
		}
	}

	// Handle end call
	function handleEndCall() {
		if (callStore) {
			callStore.ttsQueue.clearQueue();
		}
		onClose(localRootEvent || initialRootEvent);
	}

	// Handle agent selection
	function handleAgentSelect(pubkey: string | null) {
		selectedAgentPubkey = pubkey;
		if (callStore) {
			callStore.updateOptions({ activeAgent });
		}
	}

	// Handle agent configuration
	async function handleAgentConfigure(config?: { model: string; tools: string[] }) {
		if (!ndk || !currentUser || !project || !activeAgent) {
			console.error('[CallView] Missing required data for agent configuration');
			return;
		}

		// If no config provided, just log (dialog would need to be implemented)
		if (!config) {
			console.log('[CallView] Agent configuration dialog not yet implemented');
			return;
		}

		try {
			const projectTagId = project.tagId();
			if (!projectTagId) {
				console.error('[CallView] Project tag ID not found');
				return;
			}

			// Create a kind 24020 event to update agent configuration
			const changeEvent = new NDKEvent(ndk);
			changeEvent.kind = 24020 as NDKKind;
			changeEvent.content = '';
			changeEvent.tags = [
				['p', activeAgent.pubkey], // Target agent
				['model', config.model], // New model slug
				['a', projectTagId] // Project reference
			];

			// Add tool tags - one tag per tool
			config.tools.forEach((tool) => {
				changeEvent.tags.push(['tool', tool]);
			});

			await changeEvent.sign();
			await changeEvent.publish();

			console.log('[CallView] Agent settings updated successfully');
		} catch (error) {
			console.error('[CallView] Failed to update agent settings:', error);
		}
	}
</script>

<div class="flex flex-col bg-black {isEmbedded ? 'h-full' : 'fixed inset-0 z-50'}">
	<!-- Header -->
	<div class="flex items-center justify-between p-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-medium text-white">{project?.title || 'Voice Call'}</h2>
			{#if onlineAgents.length > 0}
				<AgentSelector
					agents={onlineAgents}
					selectedAgent={selectedAgentPubkey}
					defaultAgent={defaultAgent}
					currentModel={activeProjectAgent?.model}
					onSelect={handleAgentSelect}
					onConfigure={handleAgentConfigure}
				/>
			{/if}
		</div>
		<div class="text-sm text-white/60">
			{vadModeDisplay}
		</div>
	</div>

	<!-- Main content -->
	<div class="flex flex-1 flex-col items-center justify-center px-6">
		<!-- Agent display -->
		{#if activeProjectAgent}
			<AgentAvatar agent={activeProjectAgent} isActive={callState === 'playing'} />
		{:else}
			<div class="h-20 w-20 rounded-full bg-white/10 flex items-center justify-center text-white">
				{project?.title?.[0]?.toUpperCase() || 'P'}
			</div>
			<div class="mt-4 text-center text-white">
				{project?.title || 'Project'}
			</div>
		{/if}

		<!-- Voice Visualizer -->
		<div class="mb-4 mt-8">
			<VoiceVisualizer
				isActive={callStore?.audioRecorder.isRecording || false}
				audioLevel={callStore?.audioRecorder.audioLevel || 0}
				color={getProjectColor(project)}
			/>
		</div>

		<!-- Status display -->
		<CallStatus
			{callState}
			transcript={callStore?.transcript || ''}
			isVADEnabled={callStore?.vad.options.enabled || false}
		/>
	</div>

	<!-- Controls -->
	<AudioControls
		isRecording={callStore?.audioRecorder.isRecording || false}
		isProcessing={callStore?.callState === 'processing' || callStore?.messaging.isProcessing || false}
		hasTranscript={!!callStore?.transcript?.trim()}
		audioLevel={callStore?.audioRecorder.audioLevel || 0}
		isVADEnabled={callStore?.vad.options.enabled || false}
		isVADPaused={callStore?.vad.isPaused || false}
		onEndCall={handleEndCall}
		onMicToggle={handleMicToggle}
		onSend={handleSend}
	/>
</div>
