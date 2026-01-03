<script lang="ts">
	interface TodoItem {
		title: string;
		description?: string;
	}

	interface Props {
		items: TodoItem[];
		content?: string;
	}

	let { items, content }: Props = $props();
</script>

{#if content}
	<span class="text-sm text-muted-foreground">{content}</span>
{/if}
