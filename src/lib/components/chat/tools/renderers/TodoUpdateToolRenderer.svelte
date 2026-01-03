<script lang="ts">
	interface TodoUpdateItem {
		id: string;
		status?: string;
		title?: string;
		description?: string;
	}

	interface Props {
		items: TodoUpdateItem[];
		content?: string;
	}

	let { items, content }: Props = $props();
</script>

{#if content}
	<span class="text-sm text-muted-foreground">{content}</span>
{/if}
