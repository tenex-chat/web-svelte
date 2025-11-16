<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
	import { Sparkles } from 'lucide-svelte';
	import { createProfileFetcher } from '$lib/ndk/builders/profile';

	interface Props {
		pubkey: string;
	}

	let { pubkey }: Props = $props();

	// Subscribe to AgentDefinition (kind 4199)
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

	// Fetch user profile
	const profileFetcher = createProfileFetcher(() => ({ user: pubkey }), ndk);
	const profile = $derived(profileFetcher.profile);

	const description = $derived(
		agentDef?.content || agentMetadata?.about || profile?.about || 'No description provided'
	);

	const instructions = $derived(
		agentDef?.tagValue('instructions') ||
			agentMetadata?.instructions ||
			agentMetadata?.systemPrompt
	);

	const useCriteria = $derived.by(() => {
		if (agentDef) {
			return agentDef.tags.filter((t: string[]) => t[0] === 'use-criteria').map((t: string[]) => t[1]);
		}
		return agentMetadata?.useCriteria || [];
	});
</script>

<div class="space-y-4">
	<!-- Metadata Warning Card -->
	{#if !agentDef && agentMetadata}
		<div
			class="border border-orange-500/50 bg-orange-50/10 rounded-lg p-4"
		>
			<div class="flex items-center gap-2 mb-2">
				<Sparkles class="w-5 h-5 text-orange-500" />
				<h3 class="font-semibold text-foreground">
					Agent Metadata from Profile
				</h3>
			</div>
			<p class="text-sm text-muted-foreground mb-4">
				This agent has metadata stored in their Nostr profile (kind:0 event). Convert it to an
				Agent Definition for better structure and compatibility.
			</p>
		</div>
	{/if}

	<!-- Description Card -->
	<div class="bg-card border border-border rounded-lg">
		<div class="px-4 py-3 border-b border-border">
			<h3 class="font-semibold text-foreground">Description</h3>
		</div>
		<div class="px-4 py-3">
			<p class="text-muted-foreground text-sm">
				{description}
			</p>
		</div>
	</div>

	<!-- Instructions Card -->
	{#if instructions}
		<div class="bg-card border border-border rounded-lg">
			<div class="px-4 py-3 border-b border-border">
				<h3 class="font-semibold text-foreground">
					Instructions / System Prompt
				</h3>
			</div>
			<div class="px-4 py-3">
				<pre
					class="whitespace-pre-wrap text-sm text-muted-foreground font-mono">{instructions}</pre>
			</div>
		</div>
	{/if}

	<!-- Use Criteria Card -->
	{#if useCriteria.length > 0}
		<div class="bg-card border border-border rounded-lg">
			<div class="px-4 py-3 border-b border-border">
				<h3 class="font-semibold text-foreground">Use Criteria</h3>
				<p class="text-sm text-muted-foreground">When this agent should be used</p>
			</div>
			<div class="px-4 py-3">
				<ul class="space-y-2">
					{#each useCriteria as criteria (criteria)}
						<li class="flex items-start gap-2 text-sm text-muted-foreground">
							<span class="text-muted-foreground">•</span>
							<span>{criteria}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}
</div>
