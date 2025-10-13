<script lang="ts">
	import { blossomSettingsStore, type BlossomServer } from '$lib/stores/blossomSettings.svelte';
	import { cn } from '$lib/utils/cn';

	const settings = $derived(blossomSettingsStore.settings);
	const uploadConfig = $derived(settings.uploadConfig);
	const servers = $derived(settings.servers);

	let serverUrl = $state('');
	let serverName = $state('');
	let showAddServer = $state(false);

	function addServer() {
		if (!serverUrl.trim()) return;

		try {
			blossomSettingsStore.addServer(serverUrl.trim(), serverName.trim() || undefined);
			serverUrl = '';
			serverName = '';
			showAddServer = false;
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Failed to add server');
		}
	}

	function removeServer(url: string) {
		if (confirm('Are you sure you want to remove this server?')) {
			blossomSettingsStore.removeServer(url);
		}
	}

	function checkServer(url: string) {
		blossomSettingsStore.checkServerStatus(url);
	}

	function checkAllServers() {
		blossomSettingsStore.checkAllServers();
	}

	function getStatusColor(status?: BlossomServer['status']) {
		switch (status) {
			case 'online':
				return 'bg-green-500';
			case 'offline':
				return 'bg-red-500';
			case 'checking':
				return 'bg-yellow-500 animate-pulse';
			default:
				return 'bg-gray-300';
		}
	}

	function getStatusText(status?: BlossomServer['status']) {
		switch (status) {
			case 'online':
				return 'Online';
			case 'offline':
				return 'Offline';
			case 'checking':
				return 'Checking...';
			default:
				return 'Unknown';
		}
	}
</script>

<div class="space-y-6">
	<!-- Upload Configuration Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Upload Configuration</h3>
		<div class="space-y-4">
			<!-- Max File Size -->
			<div>
				<label for="max-size" class="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
					Maximum File Size (MB)
				</label>
				<input
					id="max-size"
					type="number"
					min="1"
					max="100"
					value={uploadConfig.maxSizeMB}
					onchange={(e) =>
						blossomSettingsStore.updateUploadConfig({
							maxSizeMB: parseInt(e.currentTarget.value)
						})}
					class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
				/>
				<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Maximum file size for uploads (1-100 MB)</p>
			</div>

			<!-- Compress Images -->
			<div class="flex items-center justify-between">
				<div>
					<label for="compress-images" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Compress Images
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">Automatically compress images before upload</p>
				</div>
				<button
					id="compress-images"
					onclick={() =>
						blossomSettingsStore.updateUploadConfig({
							compressImages: !uploadConfig.compressImages
						})}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						uploadConfig.compressImages ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-800'
					)}
					role="switch"
					aria-checked={uploadConfig.compressImages}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							uploadConfig.compressImages ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>

			<!-- Strip EXIF -->
			<div class="flex items-center justify-between">
				<div>
					<label for="strip-exif" class="text-sm font-medium text-gray-900 dark:text-gray-100">
						Strip EXIF Data
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400">Remove metadata from images for privacy</p>
				</div>
				<button
					id="strip-exif"
					onclick={() =>
						blossomSettingsStore.updateUploadConfig({ stripExif: !uploadConfig.stripExif })}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						uploadConfig.stripExif ? 'bg-blue-600' : 'bg-gray-200 dark:bg-zinc-800'
					)}
					role="switch"
					aria-checked={uploadConfig.stripExif}
				>
					<span
						class={cn(
							'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
							uploadConfig.stripExif ? 'translate-x-6' : 'translate-x-1'
						)}
					/>
				</button>
			</div>
		</div>
	</div>

	<!-- Blossom Servers Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Blossom Servers</h3>
			<div class="flex gap-2">
				<button
					onclick={checkAllServers}
					class="px-3 py-1 text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
					disabled={servers.length === 0}
				>
					Check All
				</button>
				<button
					onclick={() => (showAddServer = !showAddServer)}
					class="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors"
				>
					{showAddServer ? 'Cancel' : 'Add Server'}
				</button>
			</div>
		</div>

		<!-- Add Server Form -->
		{#if showAddServer}
			<div class="mb-4 p-4 bg-gray-50 dark:bg-zinc-950 rounded-lg space-y-3">
				<div>
					<label for="server-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Server URL
					</label>
					<input
						id="server-url"
						type="url"
						bind:value={serverUrl}
						placeholder="https://blossom.example.com"
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="server-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
						Server Name (Optional)
					</label>
					<input
						id="server-name"
						type="text"
						bind:value={serverName}
						placeholder="My Blossom Server"
						class="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100"
					/>
				</div>
				<button
					onclick={addServer}
					disabled={!serverUrl.trim()}
					class={cn(
						'w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors',
						!serverUrl.trim() && 'opacity-50 cursor-not-allowed'
					)}
				>
					Add Server
				</button>
			</div>
		{/if}

		<!-- Server List -->
		{#if servers.length === 0}
			<div class="text-center py-8 text-gray-500 dark:text-gray-400">
				<p class="text-sm">No Blossom servers configured</p>
				<p class="text-xs mt-1">Add a server to start uploading files</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each servers as server (server.url)}
					<div class="flex items-center justify-between p-3 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800">
						<div class="flex items-center gap-3 flex-1">
							<div class={cn('w-3 h-3 rounded-full', getStatusColor(server.status))}></div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
									{server.name || server.url}
								</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{server.url}</p>
								{#if server.lastChecked}
									<p class="text-xs text-gray-400 dark:text-gray-500">
										Last checked: {new Date(server.lastChecked).toLocaleString()}
									</p>
								{/if}
							</div>
							<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
								{getStatusText(server.status)}
							</span>
						</div>
						<div class="flex items-center gap-2 ml-4">
							<button
								onclick={() => checkServer(server.url)}
								class="px-3 py-1 text-xs bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors"
								disabled={server.status === 'checking'}
							>
								Test
							</button>
							<button
								onclick={() => removeServer(server.url)}
								class="px-3 py-1 text-xs bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-300 rounded transition-colors"
							>
								Remove
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-4 p-4 bg-blue-50 rounded-lg">
			<p class="text-xs text-blue-900 font-medium mb-1">About Blossom Servers</p>
			<p class="text-xs text-blue-700">
				Blossom is a protocol for storing blobs of data on publicly accessible servers. Files
				uploaded to Blossom servers can be accessed via their hash, providing content-addressed
				storage.
			</p>
		</div>
	</div>
</div>
