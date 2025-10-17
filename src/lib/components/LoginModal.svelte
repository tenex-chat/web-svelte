<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
	import { goto } from '$app/navigation';
	import { loginModal } from '$lib/stores/loginModal.svelte';
	import { onMount } from 'svelte';

	let isLoggingIn = $state(false);
	let activeTab = $state<'extension' | 'nsec'>('extension');
	let nsecInput = $state('');
	let error = $state('');
	let hasNip07 = $state(false);

	onMount(() => {
		// Check for NIP-07 extension with delay for async loading
		const checkNip07 = () => {
			if (typeof window !== 'undefined' && window.nostr) {
				hasNip07 = true;
			}
		};

		// Check immediately
		checkNip07();

		// Check again after delay (some extensions load async)
		const timer = setTimeout(checkNip07, 1000);

		return () => clearTimeout(timer);
	});

	async function loginWithNip07() {
		if (!window.nostr) {
			error = 'No Nostr extension found. Please install Alby, nos2x, or another NIP-07 extension.';
			return;
		}

		try {
			isLoggingIn = true;
			error = '';
			const signer = new NDKNip07Signer();
			await ndk.$sessions.login(signer);
			loginModal.close();
			goto('/projects');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to login with extension';
		} finally {
			isLoggingIn = false;
		}
	}

	async function loginWithNsec() {
		const trimmedNsec = nsecInput.trim();

		if (!trimmedNsec) {
			error = 'Please enter your nsec';
			return;
		}

		if (!trimmedNsec.startsWith('nsec1') || trimmedNsec.length < 50) {
			error = 'Invalid nsec format';
			return;
		}

		try {
			isLoggingIn = true;
			error = '';
			const signer = new NDKPrivateKeySigner(trimmedNsec);
			await ndk.$sessions.login(signer);
			loginModal.close();
			nsecInput = '';
			goto('/projects');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid nsec';
		} finally {
			isLoggingIn = false;
		}
	}

	function handleNsecKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && nsecInput.trim()) {
			loginWithNsec();
		}
	}
</script>

{#if loginModal.show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
		onclick={() => loginModal.close()}
		onkeydown={(e) => {
			if (e.key === 'Escape') loginModal.close();
		}}
		role="presentation"
	>
		<div
			class="bg-card rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="0"
		>
			<!-- Header -->
			<div class="px-6 pt-6 pb-4">
				<div class="flex items-center justify-between mb-2">
					<h2 class="text-2xl font-bold text-foreground">Welcome to TENEX</h2>
					<button
						onclick={() => loginModal.close()}
						class="text-muted-foreground hover:text-muted-foreground transition-colors"
						aria-label="Close login modal"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
				<p class="text-muted-foreground">Login with your Nostr account to continue</p>
			</div>

			<!-- Tabs -->
			<div class="px-6">
				<div class="flex gap-2 border-b border-border">
					<button
						onclick={() => (activeTab = 'extension')}
						class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'extension'
							? 'text-primary border-b-2 border-blue-600'
							: 'text-muted-foreground hover:text-foreground'}"
						disabled={!hasNip07}
					>
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
							Extension
						</div>
					</button>
					<button
						onclick={() => (activeTab = 'nsec')}
						class="px-4 py-2 text-sm font-medium transition-colors {activeTab === 'nsec'
							? 'text-primary border-b-2 border-blue-600'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<div class="flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
								/>
							</svg>
							Private Key
						</div>
					</button>
				</div>
			</div>

			<!-- Content -->
			<div class="px-6 py-6">
				{#if error}
					<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex gap-2">
						<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<div>{error}</div>
					</div>
				{/if}

				{#if activeTab === 'extension'}
					<div class="space-y-4">
						<div class="text-center space-y-2">
							<p class="text-sm text-muted-foreground">
								{hasNip07
									? 'Login securely with your browser extension'
									: 'No Nostr extension detected'}
							</p>
							{#if !hasNip07}
								<p class="text-xs text-muted-foreground">
									Install
									<a
										href="https://getalby.com"
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary underline"
									>
										Alby
									</a>
									,
									<a
										href="https://github.com/fiatjaf/nos2x"
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary underline"
									>
										nos2x
									</a>
									, or another NIP-07 extension
								</p>
							{/if}
						</div>

						<button
							onclick={loginWithNip07}
							disabled={isLoggingIn || !hasNip07}
							class="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
						>
							{#if isLoggingIn}
								<svg
									class="w-5 h-5 animate-spin"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Connecting to extension...
							{:else}
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 10V3L4 14h7v7l9-11h-7z"
									/>
								</svg>
								Login with Extension
							{/if}
						</button>

						<p class="text-xs text-center text-muted-foreground">
							Your keys stay in your browser extension
						</p>
					</div>
				{:else if activeTab === 'nsec'}
					<div class="space-y-4">
						<div>
							<label for="nsec" class="block text-sm font-medium text-foreground mb-2">
								Private Key (nsec)
							</label>
							<div class="relative">
								<svg
									class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
								<input
									id="nsec"
									type="password"
									bind:value={nsecInput}
									onkeydown={handleNsecKeydown}
									placeholder="nsec1..."
									disabled={isLoggingIn}
									autocomplete="off"
									class="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-muted disabled:cursor-not-allowed"
								/>
							</div>
							<p class="mt-1 text-xs text-muted-foreground">
								Your private key is stored locally and never sent to any server
							</p>
						</div>

						<button
							onclick={loginWithNsec}
							disabled={isLoggingIn || !nsecInput.trim()}
							class="w-full py-3 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
						>
							{#if isLoggingIn}
								<svg
									class="w-5 h-5 animate-spin"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
									/>
								</svg>
								Logging in...
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
								Login with Private Key
							{/if}
						</button>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 bg-muted border-t border-border">
				<p class="text-xs text-center text-muted-foreground">
					Don't have a Nostr key?
					<a
						href="https://nostr.com"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline"
					>
						Learn more about Nostr
					</a>
				</p>
			</div>
		</div>
	</div>
{/if}
