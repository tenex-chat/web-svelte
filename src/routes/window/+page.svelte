<script lang="ts">
	import { page } from '$app/stores';
	import ChatView from '$lib/components/chat/ChatView.svelte';
	import SettingsTab from '$lib/components/settings/SettingsTab.svelte';
	import DocumentView from '$lib/components/docs/DocumentView.svelte';
	import AgentProfileTabs from '$lib/components/agents/AgentProfileTabs.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';

	const params = $derived($page.url.searchParams);
	const windowType = $derived(params.get('type') || 'chat');
	const projectId = $derived(params.get('projectId') || undefined);
	const threadId = $derived(params.get('threadId') || undefined);
	const agentPubkey = $derived(params.get('agentPubkey'));

	const onlineAgents = $derived(
		projectId ? projectStatusStore.getOnlineAgents(projectId) : []
	);
</script>

<div class="h-screen w-screen bg-card">
	{#if windowType === 'chat'}
		<ChatView {projectId} {threadId} {onlineAgents} />
	{:else if windowType === 'settings' && projectId}
		<SettingsTab {projectId} {onlineAgents} />
	{:else if windowType === 'document'}
		<div class="p-4">
			<p class="text-sm text-muted-foreground">Document view</p>
		</div>
	{:else if windowType === 'agent' && agentPubkey}
		<AgentProfileTabs pubkey={agentPubkey} />
	{:else}
		<div class="p-4">
			<p class="text-sm text-muted-foreground">Unknown window type: {windowType}</p>
		</div>
	{/if}
</div>
