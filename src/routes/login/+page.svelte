<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { loginModal } from '$lib/stores/loginModal.svelte';

	const currentUser = $derived(ndk.$sessions.currentUser);

	onMount(() => {
		if (currentUser) {
			goto('/projects');
		} else {
			loginModal.open();
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
	<div class="text-center max-w-md">
		<h1 class="text-6xl font-bold text-foreground mb-4">TENEX</h1>
		<p class="text-xl text-muted-foreground mb-8">Orchestrate AI Agents on Nostr</p>

		{#if !currentUser}
			<button
				onclick={() => loginModal.open()}
				class="px-8 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
			>
				Get Started
			</button>
		{/if}
	</div>
</div>
