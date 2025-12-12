<script lang="ts">
	import { Users } from 'lucide-svelte';

	interface Delegation {
		recipient?: string;
		prompt?: string;
	}

	interface DelegateArgs {
		delegations?: Delegation[];
		mode?: string;
	}

	interface Props {
		args: DelegateArgs | null;
	}

	let { args }: Props = $props();

	const delegations = $derived(args?.delegations || []);
	const mode = $derived(args?.mode || 'wait');
	const recipients = $derived(delegations.map(d => d.recipient).filter(Boolean));
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<Users class="w-4 h-4 flex-shrink-0" />
	<span>
		Delegating to
		{#each recipients as recipient, i (i)}
			<code class="px-1 py-0.5 bg-muted rounded text-xs">{recipient}</code>{#if i < recipients.length - 1}, {/if}
		{/each}
		{#if mode !== 'wait'}
			<span class="text-xs">({mode})</span>
		{/if}
	</span>
</div>
