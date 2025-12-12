<script lang="ts">
	import { UserCog } from 'lucide-svelte';
	import { User } from '$lib/ndk/ui/user';
	import { ndk } from '$lib/ndk.svelte';
	import { nip19 } from 'nostr-tools';

	interface DelegateExternalArgs {
		recipient?: string;
		projectId?: string;
		content?: string;
	}

	interface Props {
		args: DelegateExternalArgs | null;
	}

	let { args }: Props = $props();

	const recipient = $derived(args?.recipient || '');
	const projectId = $derived(args?.projectId || '');

	// Extract pubkey from npub
	const recipientPubkey = $derived.by(() => {
		if (!recipient) return '';
		try {
			if (recipient.startsWith('npub')) {
				const decoded = nip19.decode(recipient);
				return decoded.type === 'npub' ? decoded.data : '';
			}
		} catch {
			return '';
		}
		return recipient;
	});

	// Extract project name from naddr
	const projectName = $derived.by(() => {
		if (!projectId) return '';
		try {
			if (projectId.startsWith('nostr:naddr')) {
				const naddrPart = projectId.replace('nostr:', '');
				const decoded = nip19.decode(naddrPart);
				if (decoded.type === 'naddr') {
					return decoded.data.identifier || '';
				}
			}
		} catch {
			return '';
		}
		return projectId;
	});
</script>

<div class="flex items-center gap-2 text-sm text-muted-foreground">
	<UserCog class="w-4 h-4 flex-shrink-0" />
	<span>
		Delegating to external agent
		{#if recipientPubkey}
			<User.Root {ndk} pubkey={recipientPubkey}>
				<code class="px-1 py-0.5 bg-muted rounded text-xs"><User.Name /></code>
			</User.Root>
		{/if}
		{#if projectName}
			in project <code class="px-1 py-0.5 bg-muted rounded text-xs">{projectName}</code>
		{/if}
	</span>
</div>
