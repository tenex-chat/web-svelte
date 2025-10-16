<script lang="ts">
	import { page } from '$app/stores';
	import { ndk } from '$lib/ndk.svelte';
	import { NDKProject } from '$lib/events/NDKProject';
	import ChatView from '$lib/components/chat/ChatView.svelte';
	import SettingsTab from '$lib/components/settings/SettingsTab.svelte';
	import DocumentView from '$lib/components/docs/DocumentView.svelte';
	import { projectStatusStore } from '$lib/stores/projectStatus.svelte';
	import type { NDKEvent } from '@nostr-dev-kit/ndk';

	const params = $derived($page.url.searchParams);
	const windowType = $derived(params.get('type') || 'chat');
	const projectId = $derived(params.get('projectId'));
	const threadId = $derived(params.get('threadId'));

	let project = $state<NDKProject | undefined>();
	let thread = $state<NDKEvent | undefined>();

	const onlineAgents = $derived(
		project ? projectStatusStore.getOnlineAgents(project.tagId()) : []
	);

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
	{:else if windowType === 'agent'}
		<div class="p-4">
			<h3 class="text-lg font-semibold text-foreground">Agent Details</h3>
			<p class="text-sm text-muted-foreground mt-2">Agent details coming soon...</p>
		</div>
	{:else}
		<div class="p-4">
			<p class="text-sm text-muted-foreground">Unknown window type: {windowType}</p>
		</div>
	{/if}
</div>
