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
				return 'bg-muted-foreground';
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
	<div class="bg-card rounded-lg border border-border p-6">
		<h3 class="text-lg font-semibold text-foreground mb-4">Upload Configuration</h3>
		<div class="space-y-4">
			<!-- Max File Size -->
			<div>
				<label for="max-size" class="block text-sm font-medium text-foreground mb-2">
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
					class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
				/>
				<p class="text-xs text-muted-foreground mt-1">Maximum file size for uploads (1-100 MB)</p>
			</div>

			<!-- Compress Images -->
			<div class="flex items-center justify-between">
				<div>
					<label for="compress-images" class="text-sm font-medium text-foreground">
						Compress Images
					</label>
					<p class="text-xs text-muted-foreground">Automatically compress images before upload</p>
				</div>
				<button
					id="compress-images"
					onclick={() =>
						blossomSettingsStore.updateUploadConfig({
							compressImages: !uploadConfig.compressImages
						})}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						uploadConfig.compressImages ? 'bg-primary' : 'bg-secondary'
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
					<label for="strip-exif" class="text-sm font-medium text-foreground">
						Strip EXIF Data
					</label>
					<p class="text-xs text-muted-foreground">Remove metadata from images for privacy</p>
				</div>
				<button
					id="strip-exif"
					onclick={() =>
						blossomSettingsStore.updateUploadConfig({ stripExif: !uploadConfig.stripExif })}
					class={cn(
						'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
						uploadConfig.stripExif ? 'bg-primary' : 'bg-secondary'
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
	<div class="bg-card rounded-lg border border-border p-6">
		<div class="flex items-center justify-between mb-4">
			<h3 class="text-lg font-semibold text-foreground">Blossom Servers</h3>
			<div class="flex gap-2">
				<button
					onclick={checkAllServers}
					class="px-3 py-1 text-sm bg-muted hover:bg-secondary rounded-md transition-colors"
					disabled={servers.length === 0}
				>
					Check All
				</button>
				<button
					onclick={() => (showAddServer = !showAddServer)}
					class="px-3 py-1 text-sm bg-primary text-white hover:bg-primary/90 rounded-md transition-colors"
				>
					{showAddServer ? 'Cancel' : 'Add Server'}
				</button>
			</div>
		</div>

		<!-- Add Server Form -->
		{#if showAddServer}
			<div class="mb-4 p-4 bg-background rounded-lg space-y-3">
				<div>
					<label for="server-url" class="block text-sm font-medium text-foreground mb-1">
						Server URL
					</label>
					<input
						id="server-url"
						type="url"
						bind:value={serverUrl}
						placeholder="https://blossom.example.com"
						class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
					/>
				</div>
				<div>
					<label for="server-name" class="block text-sm font-medium text-foreground mb-1">
						Server Name (Optional)
					</label>
					<input
						id="server-name"
						type="text"
						bind:value={serverName}
						placeholder="My Blossom Server"
						class="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-background text-foreground"
					/>
				</div>
				<button
					onclick={addServer}
					disabled={!serverUrl.trim()}
					class={cn(
						'w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors',
						!serverUrl.trim() && 'opacity-50 cursor-not-allowed'
					)}
				>
					Add Server
				</button>
			</div>
		{/if}

		<!-- Server List -->
		{#if servers.length === 0}
			<div class="text-center py-8 text-muted-foreground">
				<p class="text-sm">No Blossom servers configured</p>
				<p class="text-xs mt-1">Add a server to start uploading files</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each servers as server (server.url)}
					<div class="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted">
						<div class="flex items-center gap-3 flex-1">
							<div class={cn('w-3 h-3 rounded-full', getStatusColor(server.status))}></div>
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-foreground truncate">
									{server.name || server.url}
								</p>
								<p class="text-xs text-muted-foreground truncate">{server.url}</p>
								{#if server.lastChecked}
									<p class="text-xs text-muted-foreground">
										Last checked: {new Date(server.lastChecked).toLocaleString()}
									</p>
								{/if}
							</div>
							<span class="text-xs font-medium text-muted-foreground">
								{getStatusText(server.status)}
							</span>
						</div>
						<div class="flex items-center gap-2 ml-4">
							<button
								onclick={() => checkServer(server.url)}
								class="px-3 py-1 text-xs bg-muted hover:bg-secondary rounded transition-colors"
								disabled={server.status === 'checking'}
							>
								Test
							</button>
							<button
								onclick={() => removeServer(server.url)}
								class="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
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
