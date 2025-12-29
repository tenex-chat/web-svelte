<script lang="ts">
	// Todo add messages are hidden - the aggregated todo list shows the current state
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

<!-- Hidden: aggregated todo list shows current state -->
