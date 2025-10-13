<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import AccountSettings from '$lib/components/settings/AccountSettings.svelte';
	import AISettings from '$lib/components/settings/AISettings.svelte';
	import AppearanceSettings from '$lib/components/settings/AppearanceSettings.svelte';
	import NotificationSettings from '$lib/components/settings/NotificationSettings.svelte';
	import BlossomSettings from '$lib/components/settings/BlossomSettings.svelte';
	import OwnedAgentsSettings from '$lib/components/settings/OwnedAgentsSettings.svelte';
	import RelaySettings from '$lib/components/settings/RelaySettings.svelte';
	import { cn } from '$lib/utils/cn';

	type Tab = 'account' | 'ai' | 'appearance' | 'notifications' | 'blossom' | 'agents' | 'relays';

	const activeTab = $derived<Tab>(
		($page.url.searchParams.get('tab') as Tab) || 'account'
	);

	function setTab(tab: Tab) {
		goto(`/settings?tab=${tab}`, { replaceState: true });
	}

	const tabs: Array<{ value: Tab; label: string }> = [
		{ value: 'account', label: 'Account' },
		{ value: 'ai', label: 'AI' },
		{ value: 'appearance', label: 'Appearance' },
		{ value: 'notifications', label: 'Notifications' },
		{ value: 'blossom', label: 'Upload' },
		{ value: 'agents', label: 'Agents' },
		{ value: 'relays', label: 'Relays' }
	];
</script>

<svelte:head>
	<title>Settings - TENEX</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-zinc-950 p-8">
	<div class="max-w-5xl mx-auto">
		<!-- Page Header -->
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
			<p class="text-gray-600 dark:text-gray-400 mt-2">Manage your account, AI providers, appearance, and more</p>
		</div>

		<!-- Tab Navigation -->
		<div class="mb-6 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-t-lg">
			<div class="flex overflow-x-auto">
				{#each tabs as tab (tab.value)}
					<button
						onclick={() => setTab(tab.value)}
						class={cn(
							'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
							activeTab === tab.value
								? 'border-blue-600 text-blue-600'
								: 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-500'
						)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Tab Content -->
		<div class="bg-white dark:bg-zinc-900 rounded-b-lg shadow-sm p-6">
			{#if activeTab === 'account'}
				<AccountSettings />
			{:else if activeTab === 'ai'}
				<AISettings />
			{:else if activeTab === 'appearance'}
				<AppearanceSettings />
			{:else if activeTab === 'notifications'}
				<NotificationSettings />
			{:else if activeTab === 'blossom'}
				<BlossomSettings />
			{:else if activeTab === 'agents'}
				<OwnedAgentsSettings />
			{:else if activeTab === 'relays'}
				<RelaySettings />
			{/if}
		</div>
	</div>
</div>
