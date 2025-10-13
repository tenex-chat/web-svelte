<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { CallStore, type CallStoreOptions, type CallState } from '$lib/stores/call-store.svelte';
	import VoiceVisualizer from './VoiceVisualizer.svelte';
	import AudioControls from './AudioControls.svelte';
	import CallStatus from './CallStatus.svelte';
	// import AgentSelector from '../chat/AgentSelector.svelte'; // TODO: Import when available
	// import AgentAvatar from './AgentAvatar.svelte'; // TODO: Create AgentAvatar component

	interface Props {
		project: any; // TODO: Replace with NDKProject type when available
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

	// TODO: Replace these with actual NDK hooks when available
	let user: any = $state(null);
	let agents: any[] = $state([]);
	let messages: any[] = $state([]);
	let selectedAgentPubkey: string | null = $state(null);
	let activeAgent = $derived(
		selectedAgentPubkey ? agents.find((a) => a.pubkey === selectedAgentPubkey) || agents[0] : agents[0]
	);

	// TODO: Replace with actual thread management when NDK integration is complete
	let threadManagement: any = $state({
		localRootEvent: initialRootEvent,
		createThread: async () => null,
		sendReply: async () => null
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
				threadManagement: threadManagement,
				messages: messages,
				userPubkey: user?.pubkey,
				activeAgent: activeAgent,
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
			// TODO: Show toast notification
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
		onClose(threadManagement.localRootEvent || initialRootEvent);
	}
</script>

<div class="flex flex-col bg-black {isEmbedded ? 'h-full' : 'fixed inset-0 z-50'}">
	<!-- Header -->
	<div class="flex items-center justify-between p-4">
		<div class="flex items-center gap-3">
			<h2 class="text-lg font-medium text-white">{project?.title || 'Voice Call'}</h2>
			<!-- TODO: Add AgentSelector when available
			{#if agents.length > 0}
				<AgentSelector
					{agents}
					{messages}
					selectedAgent={selectedAgentPubkey}
					onAgentSelect={(pubkey) => (selectedAgentPubkey = pubkey)}
					disabled={callState === 'processing'}
				/>
			{/if}
			-->
		</div>
		<div class="text-sm text-white/60">
			{vadModeDisplay}
		</div>
	</div>

	<!-- Main content -->
	<div class="flex flex-1 flex-col items-center justify-center px-6">
		<!-- Agent display -->
		<!-- TODO: Add AgentAvatar when component is created
		{#if activeAgent}
			<AgentAvatar agent={activeAgent} isActive={callState === 'playing'} />
		{/if}
		-->

		{#if !activeAgent}
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
		/>
	</div>

	<!-- Controls -->
	<AudioControls
		isRecording={callStore?.audioRecorder.isRecording || false}
		isProcessing={callStore?.callState === 'processing' || callStore?.messaging.isProcessing || false}
		hasTranscript={!!callStore?.transcript?.trim()}
		audioLevel={callStore?.audioRecorder.audioLevel || 0}
		{onEndCall}
		onMicToggle={handleMicToggle}
		onSend={handleSend}
	/>
</div>
