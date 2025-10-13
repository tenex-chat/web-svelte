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
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Profile</h3>

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
						<div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center">
							<svg class="w-8 h-8 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
								<path
									fill-rule="evenodd"
									d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
									clip-rule="evenodd"
								/>
							</svg>
						</div>
					{/if}
					<div>
						<p class="text-sm font-medium text-gray-900 dark:text-gray-100">
							{currentUser.profile?.displayName || currentUser.profile?.name || 'Anonymous'}
						</p>
						{#if currentUser.profile?.about}
							<p class="text-xs text-gray-500 dark:text-gray-400">{currentUser.profile.about}</p>
						{/if}
					</div>
				</div>

				<!-- Public Key -->
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Public Key</label>
					<div class="flex gap-2">
						<input
							type="text"
							readonly
							value={currentUser.pubkey}
							class="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-md bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-gray-100 text-sm font-mono"
						/>
						<button
							onclick={copyPublicKey}
							class="px-4 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md transition-colors text-sm"
						>
							Copy
						</button>
					</div>
				</div>

				<!-- NIP-05 -->
				{#if currentUser.profile?.nip05}
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIP-05</label>
						<p class="text-sm text-gray-900 dark:text-gray-100">{currentUser.profile.nip05}</p>
					</div>
				{/if}
			</div>
		{:else}
			<div class="text-center py-8">
				<p class="text-sm text-gray-500 dark:text-gray-400">Not logged in</p>
			</div>
		{/if}
	</div>

	<!-- Account Actions Section -->
	<div class="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700 p-6">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Account Actions</h3>

		<div class="space-y-3">
			{#if currentUser}
				<button
					onclick={logout}
					class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
				>
					Logout
				</button>
			{:else}
				<p class="text-sm text-gray-500 dark:text-gray-400">Please login to manage your account</p>
			{/if}
		</div>
	</div>
</div>
