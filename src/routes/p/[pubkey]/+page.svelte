<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
	import { User } from '$lib/ndk/ui/user';
	import { ArrowLeft, Copy, CheckCircle2, Sparkles } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';
	import AgentProfileTabs from '$lib/components/agents/AgentProfileTabs.svelte';
	import CreateAgentDialog from '$lib/components/dialogs/CreateAgentDialog.svelte';
	import { createProfileFetcher } from '$lib/ndk/builders/profile';

	// Get pubkey from route params
	const pubkey = $derived($page.params.pubkey);

	// State
	let copiedPubkey = $state(false);
	let convertDialogOpen = $state(false);

	// Fetch agent profile
	const profileFetcher = createProfileFetcher(() => ({ user: pubkey }), ndk);
	const profile = $derived(profileFetcher.profile);

	// Subscribe to NDKAgentDefinition events
	const agentDefSubscription = ndk.$subscribe(() =>
		pubkey
			? {
					filters: [
						{
							kinds: [NDKKind.AgentDefinition],
							authors: [pubkey],
							limit: 1
						}
					],
					closeOnEose: false
				}
			: undefined
	);

	const agentDef = $derived(agentDefSubscription.events?.[0]);

	// Subscribe to kind:0 metadata
	const metadataSubscription = ndk.$subscribe(() =>
		pubkey
			? {
					filters: [
						{
							kinds: [NDKKind.Metadata],
							authors: [pubkey],
							limit: 1
						}
					],
					closeOnEose: false
				}
			: undefined
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

	// Create conversion data for CreateAgentDialog
	const conversionData = $derived.by(() => {
		if (!agentMetadata) return undefined;

		const baseName = agentMetadata.name || profile?.displayName || profile?.name || 'Unnamed Agent';
		const baseSlug = baseName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

		return {
			name: baseName,
			description: agentMetadata.about || '',
			role: agentMetadata.role || 'assistant',
			instructions: agentMetadata.instructions || agentMetadata.systemPrompt || '',
			useCriteria: agentMetadata.useCriteria || [],
			version: '1',
			slug: baseSlug,
			tools: [],
			mcpServers: [],
			phases: []
		};
	});

	function handleBack() {
		goto('/agents');
	}

	async function handleCopyPubkey() {
		if (!pubkey) return;
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

{#if !pubkey}
	<div class="flex items-center justify-center h-screen">
		<p class="text-muted-foreground">Invalid pubkey</p>
	</div>
{:else}
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

					<User.Root {ndk} {pubkey}>
					<User.Avatar class="w-16 h-16" />

				<div class="flex-1">
					<h1 class="text-2xl font-semibold text-foreground">
						<User.Name />
					</h1>
					<div class="flex items-center gap-2 mt-1">
						{#if role}
							<span
								class="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded"
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
								<CheckCircle2 class="w-3 h-3 text-green-500" />
							{:else}
								<Copy class="w-3 h-3" />
							{/if}
						</button>
					</div>
				</div>
				</User.Root>

				{#if showConversionButton}
					<button
						onclick={handleConvertToDefinition}
						class="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors text-sm font-medium text-foreground"
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
		<AgentProfileTabs {pubkey} />
	</div>
</div>

	<!-- Convert kind:0 metadata to Agent Definition dialog -->
	{#if conversionData}
		<CreateAgentDialog
			bind:open={convertDialogOpen}
			forkAgent={conversionData}
			cloneMode={false}
		/>
	{/if}
{/if}
