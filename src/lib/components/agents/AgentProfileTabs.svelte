<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { cn } from '$lib/utils/cn';
	import AgentFeedTab from './AgentFeedTab.svelte';
	import AgentDetailsTab from './AgentDetailsTab.svelte';
	import AgentLessonsTab from './AgentLessonsTab.svelte';
	import AgentSettingsTab from './AgentSettingsTab.svelte';

	interface Props {
		pubkey: string;
		agentDef: NDKEvent | undefined;
		agentMetadata: any;
		profile: any;
	}

	let { pubkey, agentDef, agentMetadata, profile }: Props = $props();

	type TabType = 'feed' | 'details' | 'lessons' | 'settings';

	let activeTab = $state<TabType>('feed');

	const tabs: { id: TabType; label: string }[] = [
		{ id: 'feed', label: 'Feed' },
		{ id: 'details', label: 'Details' },
		{ id: 'lessons', label: 'Lessons' },
		{ id: 'settings', label: 'Settings' }
	];
</script>

<div class="flex flex-col h-full">
	<!-- Tabs Header -->
	<div class="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
		<div class="max-w-4xl mx-auto px-4">
			<div class="flex gap-1">
				{#each tabs as tab (tab.id)}
					<button
						onclick={() => (activeTab = tab.id)}
						class={cn(
							'px-4 py-3 text-sm font-medium transition-colors relative',
							activeTab === tab.id
								? 'text-blue-600 dark:text-blue-400'
								: 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
						)}
					>
						{tab.label}
						{#if activeTab === tab.id}
							<div
								class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
							></div>
						{/if}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="flex-1 overflow-y-auto">
		<div class="max-w-4xl mx-auto p-4">
			{#if activeTab === 'feed'}
				<AgentFeedTab {pubkey} />
			{:else if activeTab === 'details'}
				<AgentDetailsTab {agentDef} {agentMetadata} {profile} />
			{:else if activeTab === 'lessons'}
				<AgentLessonsTab {pubkey} />
			{:else if activeTab === 'settings'}
				<AgentSettingsTab {pubkey} {agentDef} />
			{/if}
		</div>
	</div>
</div>
