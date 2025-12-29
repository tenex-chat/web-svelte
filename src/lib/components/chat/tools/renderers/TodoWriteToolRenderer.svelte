<script lang="ts">
	// TodoWrite messages are hidden - the aggregated todo list shows the current state
	interface Todo {
		content: string;
		status: 'pending' | 'in_progress' | 'completed';
		activeForm: string;
	}

	interface Props {
		todos: Todo[];
	}

	let { todos }: Props = $props();
</script>

<!-- Hidden: aggregated todo list shows current state -->
