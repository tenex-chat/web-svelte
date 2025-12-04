<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';

	interface Props {
		replyToEvent: NDKEvent | null;
		onCancel?: () => void;
	}

	let { replyToEvent, onCancel }: Props = $props();
</script>

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
			onclick={onCancel}
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
