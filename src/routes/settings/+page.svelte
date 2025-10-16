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
	import { ArrowLeft } from 'lucide-svelte';

	type Tab = 'account' | 'ai' | 'appearance' | 'notifications' | 'blossom' | 'agents' | 'relays';

	const activeTab = $derived<Tab>(
		($page.url.searchParams.get('tab') as Tab) || 'account'
	);

	function setTab(tab: Tab) {
		goto(`/settings?tab=${tab}`, { replaceState: true });
	}

	function goBack() {
		goto('/');
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

<div class="min-h-screen bg-background p-8">
	<div class="max-w-5xl mx-auto">
		<!-- Page Header -->
		<div class="mb-8">
			<button
				onclick={goBack}
				class="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:bg-muted rounded-lg transition-colors mb-4"
			>
				<ArrowLeft class="w-4 h-4" />
				Back to Projects
			</button>
			<h1 class="text-3xl font-bold text-foreground">Settings</h1>
			<p class="text-muted-foreground mt-2">Manage your account, AI providers, appearance, and more</p>
		</div>

		<!-- Tab Navigation -->
		<div class="mb-6 border-b border-border bg-card rounded-t-lg">
			<div class="flex overflow-x-auto">
				{#each tabs as tab (tab.value)}
					<button
						onclick={() => setTab(tab.value)}
						class={cn(
							'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
							activeTab === tab.value
								? 'border-blue-600 text-primary'
								: 'border-transparent text-muted-foreground hover:text-foreground dark:hover:text-foreground hover:border-border dark:hover:border-gray-500'
						)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Tab Content -->
		<div class="bg-card rounded-b-lg shadow-sm p-6">
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
