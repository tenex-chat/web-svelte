<script lang="ts">
	import { relaySettingsStore } from '$lib/stores/relaySettings.svelte';
	import { cn } from '$lib/utils/cn';
	import { onMount } from 'svelte';

	const relays = $derived(relaySettingsStore.relays);

	let relayUrl = $state('');
	let showAddRelay = $state(false);
	let relayStatuses = $state<Record<string, 'connected' | 'connecting' | 'disconnected'>>({});

	onMount(() => {
		updateRelayStatuses();
		const interval = setInterval(updateRelayStatuses, 5000);
		return () => clearInterval(interval);
	});

	function updateRelayStatuses() {
		const newStatuses: Record<string, 'connected' | 'connecting' | 'disconnected'> = {};
		for (const relay of relays) {
			newStatuses[relay] = relaySettingsStore.getRelayStatus(relay);
		}
		relayStatuses = newStatuses;
	}

	function addRelay() {
		if (!relayUrl.trim()) return;

		try {
			relaySettingsStore.addRelay(relayUrl.trim());
			relayUrl = '';
			showAddRelay = false;
			setTimeout(updateRelayStatuses, 500);
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to add relay');
		}
	}

	function removeRelay(url: string) {
		if (confirm('Are you sure you want to remove this relay?')) {
			relaySettingsStore.removeRelay(url);
			updateRelayStatuses();
		}
	}

	function getStatusColor(status: 'connected' | 'connecting' | 'disconnected') {
		switch (status) {
			case 'connected':
				return 'bg-green-500';
			case 'connecting':
				return 'bg-yellow-500 animate-pulse';
			case 'disconnected':
				return 'bg-red-500';
		}
	}

	function getStatusText(status: 'connected' | 'connecting' | 'disconnected') {
		switch (status) {
			case 'connected':
				return 'Connected';
			case 'connecting':
				return 'Connecting...';
			case 'disconnected':
				return 'Disconnected';
		}
	}
</script>

<div class="space-y-6">
	<!-- Nostr Relays Section -->
	<div class="bg-card rounded-lg border border-border p-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-foreground">Nostr Relays</h3>
			<button
				onclick={() => (showAddRelay = !showAddRelay)}
				class="px-3 py-1 text-sm bg-primary text-white hover:bg-primary/90 rounded-md transition-colors"
			>
				{showAddRelay ? 'Cancel' : 'Add Relay'}
			</button>
		</div>

		<p class="text-sm text-muted-foreground mb-4">
			Manage the Nostr relays your client connects to for publishing and fetching events
		</p>

		<!-- Add Relay Form -->
		{#if showAddRelay}
			<div class="mb-4 p-4 bg-background rounded-lg space-y-3">
				<div>
					<label for="relay-url" class="block text-sm font-medium text-foreground mb-1">
						Relay URL
					</label>
					<input
						id="relay-url"
						type="text"
						bind:value={relayUrl}
						placeholder="wss://relay.example.com"
						class="w-full px-3 py-2 border border-border dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
						onkeydown={(e) => e.key === 'Enter' && addRelay()}
					/>
					<p class="text-xs text-muted-foreground mt-1">Must start with wss:// or ws://</p>
				</div>
				<button
					onclick={addRelay}
					disabled={!relayUrl.trim()}
					class={cn(
						'w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors',
						!relayUrl.trim() && 'opacity-50 cursor-not-allowed'
					)}
				>
					Add Relay
				</button>
			</div>
		{/if}

		<!-- Relay List -->
		{#if relays.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p class="text-sm">No relays configured</p>
				<p class="text-xs mt-1">Add a relay to start connecting to the Nostr network</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each relays as relay (relay)}
					<div class="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted dark:hover:bg-zinc-800">
						<div class="flex items-center gap-3 flex-1 min-w-0">
							<div class={cn('w-3 h-3 rounded-full', getStatusColor(relayStatuses[relay]))}></div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-foreground truncate">{relay}</p>
								<p class="text-xs text-muted-foreground">{getStatusText(relayStatuses[relay])}</p>
							</div>
						</div>
						<button
							onclick={() => removeRelay(relay)}
							class="ml-4 px-3 py-1 text-xs bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors"
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
			<p class="text-xs text-blue-900 dark:text-blue-100 font-medium mb-1">About Nostr Relays</p>
			<p class="text-xs text-blue-700 dark:text-blue-300">
				Relays are servers that store and distribute Nostr events. Your client connects to multiple
				relays to ensure redundancy and censorship resistance. Adding more relays improves network
				reliability but may increase bandwidth usage.
			</p>
		</div>
	</div>

	<!-- Popular Relays Section -->
	<div class="bg-card rounded-lg border border-border p-6">
		<h3 class="text-lg font-semibold text-foreground mb-4">Popular Relays</h3>
		<p class="text-sm text-muted-foreground mb-4">Quick add popular public relays</p>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-2">
			{#each ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band', 'wss://relay.primal.net'] as popularRelay}
				<button
					onclick={() => {
						try {
							relaySettingsStore.addRelay(popularRelay);
							setTimeout(updateRelayStatuses, 500);
						} catch (error) {
							if (error instanceof Error && error.message.includes('already exists')) {
								return;
							}
							alert(error instanceof Error ? error.message : 'Failed to add relay');
						}
					}}
					disabled={relays.includes(popularRelay)}
					class={cn(
						'px-3 py-2 text-sm border rounded-md transition-colors text-left',
						relays.includes(popularRelay)
							? 'bg-muted text-muted-foreground cursor-not-allowed border-border dark:border-zinc-700'
							: 'bg-card hover:bg-muted dark:hover:bg-zinc-800 border-border dark:border-zinc-700'
					)}
				>
					{popularRelay}
					{#if relays.includes(popularRelay)}
						<span class="ml-2 text-xs">(Added)</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>
</div>
