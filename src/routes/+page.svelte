<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	const currentUser = $derived(ndk.$sessions.currentUser);

	onMount(() => {
		if (currentUser) {
			goto('/projects');
		} else {
			goto('/login');
		}
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
	<div class="text-center">
		<div
			class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
		></div>
		<p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
	</div>
</div>
