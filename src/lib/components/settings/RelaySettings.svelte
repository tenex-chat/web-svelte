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
	<div class="bg-white rounded-lg border p-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-gray-900">Nostr Relays</h3>
			<button
				onclick={() => (showAddRelay = !showAddRelay)}
				class="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
			>
				{showAddRelay ? 'Cancel' : 'Add Relay'}
			</button>
		</div>

		<p class="text-sm text-gray-500 mb-4">
			Manage the Nostr relays your client connects to for publishing and fetching events
		</p>

		<!-- Add Relay Form -->
		{#if showAddRelay}
			<div class="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
				<div>
					<label for="relay-url" class="block text-sm font-medium text-gray-700 mb-1">
						Relay URL
					</label>
					<input
						id="relay-url"
						type="text"
						bind:value={relayUrl}
						placeholder="wss://relay.example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						onkeydown={(e) => e.key === 'Enter' && addRelay()}
					/>
					<p class="text-xs text-gray-500 mt-1">Must start with wss:// or ws://</p>
				</div>
				<button
					onclick={addRelay}
					disabled={!relayUrl.trim()}
					class={cn(
						'w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
						!relayUrl.trim() && 'opacity-50 cursor-not-allowed'
					)}
				>
					Add Relay
				</button>
			</div>
		{/if}

		<!-- Relay List -->
		{#if relays.length === 0}
			<div class="text-center py-8 text-gray-500">
				<p class="text-sm">No relays configured</p>
				<p class="text-xs mt-1">Add a relay to start connecting to the Nostr network</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each relays as relay (relay)}
					<div class="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
						<div class="flex items-center gap-3 flex-1 min-w-0">
							<div class={cn('w-3 h-3 rounded-full', getStatusColor(relayStatuses[relay]))}></div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 truncate">{relay}</p>
								<p class="text-xs text-gray-500">{getStatusText(relayStatuses[relay])}</p>
							</div>
						</div>
						<button
							onclick={() => removeRelay(relay)}
							class="ml-4 px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
						>
							Remove
						</button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-4 p-4 bg-blue-50 rounded-lg">
			<p class="text-xs text-blue-900 font-medium mb-1">About Nostr Relays</p>
			<p class="text-xs text-blue-700">
				Relays are servers that store and distribute Nostr events. Your client connects to multiple
				relays to ensure redundancy and censorship resistance. Adding more relays improves network
				reliability but may increase bandwidth usage.
			</p>
		</div>
	</div>

	<!-- Popular Relays Section -->
	<div class="bg-white rounded-lg border p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Popular Relays</h3>
		<p class="text-sm text-gray-500 mb-4">Quick add popular public relays</p>

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
							? 'bg-gray-100 text-gray-400 cursor-not-allowed'
							: 'bg-white hover:bg-gray-50 border-gray-300'
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
