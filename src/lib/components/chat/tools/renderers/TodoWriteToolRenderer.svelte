<script lang="ts">
	import { ListTodo, Check, Circle, Loader2 } from 'lucide-svelte';

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

<div class="text-sm">
	<div class="flex items-center gap-2 text-muted-foreground mb-2">
		<ListTodo class="w-4 h-4 flex-shrink-0" />
		<span>Updating task list</span>
	</div>

	{#if todos.length > 0}
		<ul class="ml-6 space-y-1">
			{#each todos as todo}
				<li class="flex items-center gap-2">
					{#if todo.status === 'completed'}
						<Check class="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
						<span class="text-muted-foreground line-through">{todo.content}</span>
					{:else if todo.status === 'in_progress'}
						<Loader2 class="w-3.5 h-3.5 text-blue-500 flex-shrink-0 animate-spin" />
						<span class="text-foreground">{todo.content}</span>
					{:else}
						<Circle class="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
						<span class="text-muted-foreground">{todo.content}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
