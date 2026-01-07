<script lang="ts">
	import { goto } from '$app/navigation';
	import { inboxColumnStore } from '$lib/stores/inboxColumn.svelte';
	import { onMount } from 'svelte';

	// Redirect to main page and open the inbox column
	onMount(() => {
		inboxColumnStore.open();
		goto('/');
	});
</script>

<div class="flex items-center justify-center h-full">
	<p class="text-muted-foreground">Redirecting to inbox...</p>
</div>
