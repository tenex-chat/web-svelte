<script lang="ts">
	import ndk from '$lib/ndk.svelte';
	import { User } from '$lib/ndk/ui/user';

	function logout() {
		if (ndk.$currentPubkey) {
			ndk.$sessions.logout();
		}
		window.location.href = '/';
	}

	function copyPublicKey() {
		if (ndk.$currentPubkey) {
			navigator.clipboard.writeText(ndk.$currentPubkey);
			alert("Public key copied to clipboard");
		}
	}
</script>

<div class="space-y-6">
	<!-- User Profile Section -->
	<div class="bg-card rounded-lg border border-border p-6">
		<h3 class="text-lg font-semibold text-foreground mb-4">Profile</h3>

		{#if ndk.$currentPubkey}
			<div class="space-y-4">
				<!-- Profile Picture -->
				<div class="flex items-center gap-4">
					<User.Root user={ndk.$currentUser}>
						<User.Avatar class="w-16 h-16" />
						<div>
							<p class="text-sm font-medium text-foreground">
								<User.Name field="displayName" />
							</p>
							<User.Bio class="text-xs text-muted-foreground" />
						</div>
					</User.Root>
				</div>

				<!-- Public Key -->
				<div>
					<label class="block text-sm font-medium text-foreground mb-1">Public Key</label>
					<div class="flex gap-2">
						<input
							type="text"
							readonly
							value={ndk.$currentPubkey}
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
				<div>
					<label class="block text-sm font-medium text-foreground mb-1">NIP-05</label>
					<User.Root user={ndk.$currentUser}>
						<User.Nip05 showVerified={true} class="text-sm text-foreground" />
					</User.Root>
				</div>
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
			{#if ndk.$currentPubkey}
				<button
					onclick={logout}
					class="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
				>
					Logout
				</button>
			{:else}
				<p class="text-sm text-muted-foreground">Please login to manage your account</p>
			{/if}
		</div>
	</div>
</div>
