<script lang="ts">
	import type { NDKAgentDefinitionPack } from '$lib/events/NDKAgentDefinitionPack';
	import { generateAgentColor } from '$lib/utils/colors';
	import { Package } from 'lucide-svelte';

	interface Props {
		pack: NDKAgentDefinitionPack;
		onclick?: () => void;
		selected?: boolean;
	}

	let { pack, onclick, selected = false }: Props = $props();

	const backgroundColor = $derived(
		pack.image ? undefined : generateAgentColor(pack.id || pack.title || 'default')
	);
	const agentCount = $derived(pack.agentEventIds.length);
	const proxiedImage = $derived(
		pack.image ? `/api/proxy?url=${encodeURIComponent(pack.image)}` : null
	);

	function truncateDescription(text: string, maxLength: number = 80): string {
		if (text.length <= maxLength) return text;
		return text.slice(0, maxLength).trim() + '...';
	}
</script>

<button
	onclick={onclick}
	class="relative overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-2xl w-64 h-80 rounded-lg {selected
		? 'ring-2 ring-primary'
		: ''}"
>
	<!-- Full bleed image or color background -->
	<div class="relative h-full w-full" style={proxiedImage ? '' : `background-color: ${backgroundColor}`}>
		{#if proxiedImage}
			<img
				src={proxiedImage}
				alt={pack.title || 'Pack cover'}
				class="w-full h-full object-cover"
				crossorigin="anonymous"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center">
				<Package class="w-24 h-24 text-white/20" />
			</div>
		{/if}

		<!-- Gradient overlay -->
		<div
			class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"
		></div>

		<!-- Agent count badge -->
		<div class="absolute top-4 right-4 bg-primary rounded-full px-2.5 py-1 flex items-center gap-1">
			<span class="text-xs text-primary-foreground font-bold">
				{agentCount} AGENT{agentCount !== 1 ? 'S' : ''}
			</span>
		</div>

		<!-- Content overlay -->
		<div class="absolute bottom-0 left-0 right-0 p-6">
			<h3 class="text-3xl font-black text-white mb-2 uppercase">
				{pack.title || 'Untitled Pack'}
			</h3>

			<p class="text-sm text-gray-300 mb-4 line-clamp-2">
				{truncateDescription(pack.description) || 'No description available'}
			</p>

			<!-- Author pubkey truncated -->
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-white">
					{pack.pubkey?.slice(0, 16)}...
				</span>
			</div>
		</div>
	</div>

	<!-- Selected indicator -->
	{#if selected}
		<div
			class="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
		>
			<svg
				class="w-4 h-4 text-primary-foreground"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width={3}
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
	{/if}
</button>
