<script lang="ts">
	import { page } from '$app/stores';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKKind } from '$lib/kinds';
	import { NDKProject } from '$lib/events/NDKProject';
	import ChatView from '$lib/components/chat/ChatView.svelte';
	import SettingsTab from '$lib/components/settings/SettingsTab.svelte';
	import DocumentView from '$lib/components/docs/DocumentView.svelte';
	import AgentProfileTabs from '$lib/components/agents/AgentProfileTabs.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';

	const params = $derived($page.url.searchParams);
	const windowType = $derived(params.get('type') || 'chat');
	const projectId = $derived(params.get('projectId'));
	const threadId = $derived(params.get('threadId'));
	const agentPubkey = $derived(params.get('agentPubkey'));

	let project = $state<NDKProject | undefined>();
	let thread = $state<NDKEvent | undefined>();

	const onlineAgents = $derived(
		project ? projectStatusStore.getOnlineAgents(project.tagId()) : []
	);

	// For agent windows, fetch agent definition and metadata
	const agentDefSubscription = $derived(
		agentPubkey
			? ndk.$subscribe(() => ({
					filters: [
						{
							kinds: [NDKKind.AgentDefinition],
							authors: [agentPubkey],
							limit: 1
						}
					],
					closeOnEose: false
				}))
			: null
	);

	const metadataSubscription = $derived(
		agentPubkey
			? ndk.$subscribe(() => ({
					filters: [
						{
							kinds: [NDKKind.Metadata],
							authors: [agentPubkey],
							limit: 1
						}
					],
					closeOnEose: false
				}))
			: null
	);

	const agentDef = $derived(agentDefSubscription?.events?.[0]);
	const metadataEvent = $derived(metadataSubscription?.events?.[0]);

	const profile = $derived(agentPubkey ? ndk.$fetchProfile(() => agentPubkey) : null);

	const agentMetadata = $derived.by(() => {
		if (!metadataEvent) return null;
		try {
			const content = JSON.parse(metadataEvent.content);
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

	// Load project
	$effect(() => {
		if (projectId) {
			ndk
				.fetchEvent({
					kinds: [31933],
					'#d': [projectId]
				})
				.then((event) => {
					if (event) {
						project = new NDKProject(ndk, event.rawEvent());
					}
				});
		}
	});

	// Load thread
	$effect(() => {
		if (threadId) {
			ndk.fetchEvent(threadId).then((event) => {
				if (event) {
					thread = event;
				}
			});
		}
	});
</script>

<div class="h-screen w-screen bg-card">
	{#if windowType === 'chat'}
		<ChatView {project} rootEvent={thread} {onlineAgents} />
	{:else if windowType === 'settings' && project}
		<SettingsTab {project} {onlineAgents} />
	{:else if windowType === 'document'}
		<div class="p-4">
			<p class="text-sm text-muted-foreground">Document view</p>
		</div>
	{:else if windowType === 'agent' && agentPubkey}
		<AgentProfileTabs pubkey={agentPubkey} {agentDef} {agentMetadata} {profile} />
	{:else}
		<div class="p-4">
			<p class="text-sm text-muted-foreground">Unknown window type: {windowType}</p>
		</div>
	{/if}
</div>
