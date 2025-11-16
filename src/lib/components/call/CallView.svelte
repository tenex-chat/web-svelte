<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKThread, NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { uiSettingsStore } from '$lib/stores/uiSettings.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import { processEventsToMessages } from '$lib/utils/messageProcessor';
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


	// Get project ID for status lookups
	const projectId = $derived(project?.tagId());

	// Get online agents for this project
	const onlineAgents = $derived(projectId ? projectStatusStore.getOnlineAgents(projectId) : []);

	// Local thread state
	let localRootEvent = $state<NDKEvent | null>(initialRootEvent ?? null);
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

	// SIMPLIFIED: Subscribe to messages including streaming
	const messagesSubscription = ndk.$subscribe(() => {
		if (!localRootEvent) return undefined;

		const streamingKinds: number[] = [
			NDKKind.TenexAgentTypingStart,
			NDKKind.TenexAgentTypingStop
		];
		if (uiSettingsStore.settings.streamingResponsesEnabled) {
			streamingKinds.push(NDKKind.TenexStreamingResponse);
		}

		return {
			filters: [
				{ kinds: [11, 1111, 7, 513], ...localRootEvent.filter() },
				{ kinds: [11, 1111, 7, 513], ...localRootEvent.nip22Filter() },
				// Include streaming and typing events
				{ kinds: streamingKinds, limit: 100, ...localRootEvent.nip22Filter() }
			],
			closeOnEose: false,
			bufferMs: 30
		};
	});

	// SIMPLIFIED: Process messages for TTS queue - processEventsToMessages now handles streaming
	const messages = $derived.by(() => {
		if (!localRootEvent) return [];

		const rootEvent = localRootEvent;
		const allEvents = messagesSubscription.events.some(e => e.id === rootEvent.id)
			? messagesSubscription.events
			: [rootEvent, ...messagesSubscription.events];

		// Process everything in one pass - messageProcessor now handles all streaming logic
		return processEventsToMessages(
			allEvents,
			localRootEvent,
			'flattened',
			false, // not brainstorm
			false, // showAll
			ndk.$currentUser?.pubkey
		);
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
	let vadModeDisplay = $derived.by(() => {
		if (!callStore) return 'Manual';
		return callStore.vad.enabled ? 'Auto-detect' : 'Push-to-talk';
	});

	// Initialize call store on mount
	onMount(async () => {
		try {
			// Create CallStore with options
			const options: CallStoreOptions = {
				threadManagement,
				messages,
				userPubkey: ndk.$currentUser?.pubkey,
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
	function handleAgentConfigure(pubkey: string) {
		// TODO: Implement agent configuration dialog
		console.log('[CallView] Agent configuration requested for:', pubkey);
	}
</script>

<div class="flex flex-col bg-background {isEmbedded ? 'h-full' : 'fixed inset-0 z-50'}">
	<!-- Header -->
	<div class="flex items-center justify-between p-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-medium text-foreground">{project?.title || 'Voice Call'}</h2>
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
		<div class="text-sm text-muted-foreground">
			{vadModeDisplay}
		</div>
	</div>

	<!-- Main content -->
	<div class="flex flex-1 flex-col items-center justify-center px-6">
		<!-- Agent display -->
		{#if activeProjectAgent}
			<AgentAvatar agent={activeProjectAgent} isActive={callState === 'playing'} />
		{:else}
			<div class="h-20 w-20 rounded-full bg-muted flex items-center justify-center text-foreground">
				{project?.title?.[0]?.toUpperCase() || 'P'}
			</div>
			<div class="mt-4 text-center text-foreground">
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
			isVADEnabled={callStore?.vad.enabled || false}
		/>
	</div>

	<!-- Controls -->
	<AudioControls
		isRecording={callStore?.audioRecorder.isRecording || false}
		isProcessing={callStore?.callState === 'processing' || callStore?.messaging.isProcessing || false}
		hasTranscript={!!callStore?.transcript?.trim()}
		audioLevel={callStore?.audioRecorder.audioLevel || 0}
		isVADEnabled={callStore?.vad.enabled || false}
		isVADPaused={callStore?.vad.isPaused || false}
		onEndCall={handleEndCall}
		onMicToggle={handleMicToggle}
		onSend={handleSend}
	/>
</div>
