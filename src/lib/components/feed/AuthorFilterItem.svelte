<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';
	import { Check } from 'lucide-svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';

	interface Props {
		ndk: typeof ndk;
		pubkey: string;
		selectedAuthor: string | null;
		onclick: () => void;
	}

	const { ndk: ndkProp, pubkey, selectedAuthor, onclick }: Props = $props();

	const isCurrentUser = $derived(ndkProp.$currentUser?.pubkey === pubkey);
	const isSelected = $derived(selectedAuthor === pubkey);
</script>

<DropdownMenu.Item {onclick}>
	<User.Root ndk={ndkProp} {pubkey}>
		<div class="flex items-center justify-between w-full">
			<div class="flex items-center gap-2">
				<User.Avatar class="w-5 h-5 rounded-full flex-shrink-0" />
				{#if isCurrentUser}
					<span class="text-sm">You</span>
				{:else}
					<span class="text-sm">
						<User.Name />
					</span>
				{/if}
			</div>
			{#if isSelected}
				<Check class="h-3.5 w-3.5" />
			{/if}
		</div>
	</User.Root>
</DropdownMenu.Item>
