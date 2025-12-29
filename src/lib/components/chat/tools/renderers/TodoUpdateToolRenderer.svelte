<script lang="ts">
	// Todo update messages are hidden - the aggregated todo list shows the current state
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

<!-- Hidden: aggregated todo list shows current state -->
