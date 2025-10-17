<script lang="ts">
	import ndk from '$lib/ndk.svelte';

	const currentUser = $derived(ndk.$currentUser);

	function logout() {
		if (currentUser?.pubkey) {
			ndk.logout(currentUser.pubkey);
		}
		window.location.href = '/';
	}

	function copyPublicKey() {
		if (currentUser?.pubkey) {
			navigator.clipboard.writeText(currentUser.pubkey);
			alert('Public key copied to clipboard');
		}
	}
</script>

<div class="space-y-6">
	<!-- User Profile Section -->
	<div class="bg-card rounded-lg border border-border p-6">
		<h3 class="text-lg font-semibold text-foreground mb-4">Profile</h3>

		{#if currentUser}
			<div class="space-y-4">
				<!-- Profile Picture -->
				<div class="flex items-center gap-4">
					{#if currentUser.profile?.image}
						<img
							src={currentUser.profile.image}
							alt={currentUser.profile?.name || 'User'}
							class="w-16 h-16 rounded-full object-cover"
						/>
					{:else}
						<div class="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
							<svg class="w-8 h-8 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					{/if}
					<div>
						<p class="text-sm font-medium text-foreground">
							{currentUser.profile?.displayName || currentUser.profile?.name || 'Anonymous'}
						</p>
						{#if currentUser.profile?.about}
							<p class="text-xs text-muted-foreground">{currentUser.profile.about}</p>
						{/if}
					</div>
				</div>

				<!-- Public Key -->
				<div>
					<label class="block text-sm font-medium text-foreground mb-1">Public Key</label>
					<div class="flex gap-2">
						<input
							type="text"
							readonly
							value={currentUser.pubkey}
							class="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm font-mono"
						/>
						<button
							onclick={copyPublicKey}
							class="px-4 py-2 bg-muted hover:bg-accent text-foreground rounded-md transition-colors text-sm"
						>
							Copy
						</button>
					</div>
				</div>

				<!-- NIP-05 -->
				{#if currentUser.profile?.nip05}
					<div>
						<label class="block text-sm font-medium text-foreground mb-1">NIP-05</label>
						<p class="text-sm text-foreground">{currentUser.profile.nip05}</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center py-8">
				<p class="text-sm text-muted-foreground">Not logged in</p>
			</div>
		{/if}
	</div>

	<!-- Account Actions Section -->
	<div class="bg-card rounded-lg border border-border p-6">
		<h3 class="text-lg font-semibold text-foreground mb-4">Account Actions</h3>

		<div class="space-y-3">
			{#if currentUser}
				<button
					onclick={logout}
					class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
				>
					Logout
				</button>
			{:else}
				<p class="text-sm text-muted-foreground">Please login to manage your account</p>
			{/if}
		</div>
	</div>
</div>
