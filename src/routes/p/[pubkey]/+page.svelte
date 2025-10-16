<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '@nostr-dev-kit/ndk';
	import { Avatar, Name } from '@nostr-dev-kit/svelte';
	import { ArrowLeft, Copy, CheckCircle2, Sparkles } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import AgentProfileTabs from '$lib/components/agents/AgentProfileTabs.svelte';

	// Get pubkey from route params
	const pubkey = $derived($page.params.pubkey);

	// State
	let copiedPubkey = $state(false);
	let convertDialogOpen = $state(false);

	// Fetch agent profile
	const profile = $derived(ndk.$fetchProfile(() => pubkey));

	// Subscribe to NDKAgentDefinition events (kind 4128)
	const agentDefSubscription = ndk.$subscribe(() =>
		pubkey
			? {
					filters: [
						{
							kinds: [4128 as NDKKind],
							authors: [pubkey],
							limit: 1
						}
					],
					closeOnEose: false
				}
			: false
	);

	const agentDef = $derived(agentDefSubscription.events?.[0]);

	// Subscribe to kind:0 metadata
	const metadataSubscription = ndk.$subscribe(() =>
		pubkey
			? {
					filters: [
						{
							kinds: [0 as NDKKind],
							authors: [pubkey],
							limit: 1
						}
					],
					closeOnEose: false
				}
			: false
	);

	const metadataEvent = $derived(metadataSubscription.events?.[0]);

	// Parse agent metadata from kind:0 event
	const agentMetadata = $derived.by(() => {
		if (!metadataEvent) return null;
		try {
			const content = JSON.parse(metadataEvent.content);
			// Check if it has agent-specific fields
			if (
				content.role ||
				content.instructions ||
				content.systemPrompt ||
				content.useCriteria
			) {
				return content;
			}
		} catch {
			return null;
		}
		return null;
	});

	// Derive role from agentDef or metadata
	const role = $derived(agentDef?.tagValue('role') || agentMetadata?.role);

	// Check if we should show conversion button
	const showConversionButton = $derived(!agentDef && !!agentMetadata);

	function handleBack() {
		goto('/agents');
	}

	async function handleCopyPubkey() {
		try {
			await navigator.clipboard.writeText(pubkey);
			copiedPubkey = true;
			setTimeout(() => (copiedPubkey = false), 2000);
		} catch (error) {
			console.error('Failed to copy pubkey:', error);
		}
	}

	function handleConvertToDefinition() {
		convertDialogOpen = true;
	}
</script>

<div class="flex flex-col h-screen bg-background">
	<!-- Header -->
	<div class="bg-card border-b border-border">
		<div class="max-w-4xl mx-auto px-4 py-4">
			<div class="flex items-center gap-4 mb-4">
				<button
					onclick={handleBack}
					class="p-2 rounded-lg hover:bg-muted transition-colors"
					aria-label="Go back"
				>
					<ArrowLeft class="w-5 h-5 text-foreground" />
				</button>

				<Avatar {ndk} {pubkey} size={64} />

				<div class="flex-1">
					<h1 class="text-2xl font-semibold text-foreground">
						<Name {ndk} {pubkey} />
					</h1>
					<div class="flex items-center gap-2 mt-1">
						{#if role}
							<span
								class="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium rounded"
							>
								{role}
							</span>
						{/if}
						<button
							onclick={handleCopyPubkey}
							class="text-xs text-muted-foreground hover:text-foreground dark:hover:text-foreground font-mono flex items-center gap-1 transition-colors"
						>
							{pubkey.slice(0, 8)}...{pubkey.slice(-8)}
							{#if copiedPubkey}
								<CheckCircle2 class="w-3 h-3 text-green-500 dark:text-green-400" />
							{:else}
								<Copy class="w-3 h-3" />
							{/if}
						</button>
					</div>
				</div>

				{#if showConversionButton}
					<button
						onclick={handleConvertToDefinition}
						class="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-foreground"
					>
						<Sparkles class="w-4 h-4" />
						Convert to Agent Definition
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Tabs Content -->
	<div class="flex-1 overflow-hidden">
		<AgentProfileTabs {pubkey} {agentDef} {agentMetadata} {profile} />
	</div>
</div>

<!-- TODO: Add CreateAgentDialog for conversion -->
{#if convertDialogOpen}
	<div class="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
		<div
			class="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<h3 class="text-lg font-semibold text-foreground mb-4">
				Convert to Agent Definition
			</h3>
			<p class="text-sm text-muted-foreground mb-4">
				This feature will convert the agent's kind:0 metadata to a proper Agent Definition
				(kind 4128) event.
			</p>
			<div class="flex gap-2 justify-end">
				<button
					onclick={() => (convertDialogOpen = false)}
					class="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={() => (convertDialogOpen = false)}
					class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 dark:bg-blue-500 dark:hover:bg-primary rounded-lg transition-colors"
				>
					Convert
				</button>
			</div>
		</div>
	</div>
{/if}
