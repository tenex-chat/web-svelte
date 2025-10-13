<script lang="ts">
	import type { ProjectAgent } from '$lib/events/NDKProjectStatus';
	import { Avatar } from '@nostr-dev-kit/svelte';
	import { ndk } from '$lib/ndk.svelte';

	interface Props {
		agent: ProjectAgent;
		isActive: boolean;
		size?: number;
		class?: string;
	}

	let { agent, isActive, size = 96, class: className }: Props = $props();

	// Determine glow color based on agent or use default
	function getAgentColor(agent: ProjectAgent): string {
		// Generate deterministic color from pubkey
		const pubkey = agent.pubkey;
		if (!pubkey) return '#94a3b8';

		let hash = 0;
		for (let i = 0; i < pubkey.length; i++) {
			const char = pubkey.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}

		const hue = Math.abs(hash) % 360;
		return `hsl(${hue}, 65%, 55%)`;
	}

	const agentColor = $derived(getAgentColor(agent));
</script>

<div class="flex flex-col items-center gap-3 {className || ''}">
	<!-- Avatar with pulse effect -->
	<div class="relative" style:width="{size}px" style:height="{size}px">
		<!-- Pulsing glow when active -->
		{#if isActive}
			<div
				class="absolute inset-0 rounded-full animate-pulse-glow"
				style:background="radial-gradient(circle, {agentColor}40 0%, transparent 70%)"
				style:transform="scale(1.5)"
			></div>
		{/if}

		<!-- Avatar -->
		<div
			class="relative rounded-full overflow-hidden transition-all duration-300"
			class:ring-4={isActive}
			class:ring-opacity-50={isActive}
			style:box-shadow={isActive ? `0 0 30px ${agentColor}80` : 'none'}
			style:border-color={agentColor}
		>
			<Avatar {ndk} pubkey={agent.pubkey} {size} />
		</div>
	</div>

	<!-- Agent name -->
	<div class="text-center">
		<div class="text-white font-medium">{agent.name}</div>
		{#if agent.model}
			<div class="text-white/60 text-sm">{agent.model}</div>
		{/if}
	</div>
</div>

<style>
	@keyframes pulse-glow {
		0%,
		100% {
			opacity: 0.4;
			transform: scale(1.5);
		}
		50% {
			opacity: 0.8;
			transform: scale(1.7);
		}
	}

	.animate-pulse-glow {
		animation: pulse-glow 2s ease-in-out infinite;
	}
</style>
