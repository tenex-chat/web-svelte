<script lang="ts">
	import { ListTodo, Check, Loader2, Circle } from 'lucide-svelte';
	import type { TodoItem } from '$lib/utils/todoAggregator';

	interface Props {
		items: TodoItem[];
	}

	let { items }: Props = $props();

	function getStatusIcon(status: string) {
		switch (status) {
			case 'done':
			case 'completed':
				return Check;
			case 'in_progress':
				return Loader2;
			default:
				return Circle;
		}
	}

	function getStatusClass(status: string): string {
		switch (status) {
			case 'done':
			case 'completed':
				return 'text-green-500';
			case 'in_progress':
				return 'text-blue-500 animate-spin';
			default:
				return 'text-muted-foreground';
		}
	}

	// Count by status
	const completedCount = $derived(items.filter(i => i.status === 'done' || i.status === 'completed').length);
	const inProgressCount = $derived(items.filter(i => i.status === 'in_progress').length);
	const pendingCount = $derived(items.filter(i => i.status === 'pending' || !i.status).length);
</script>

<div class="bg-muted/30 rounded-lg p-3 border border-border/50">
	<div class="flex items-center gap-2 mb-2">
		<ListTodo class="w-4 h-4 text-primary" />
		<span class="text-sm font-medium">Todo List</span>
		<span class="text-xs text-muted-foreground ml-auto">
			{completedCount}/{items.length} done
		</span>
	</div>

	<ul class="space-y-1.5">
		{#each items as item (item.id)}
			{@const StatusIcon = getStatusIcon(item.status)}
			<li class="flex items-start gap-2 text-sm">
				<StatusIcon class="w-4 h-4 flex-shrink-0 mt-0.5 {getStatusClass(item.status)}" />
				<div class="flex-1 min-w-0">
					<span class="{item.status === 'done' || item.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}">
						{item.title}
					</span>
					{#if item.description}
						<p class="text-xs text-muted-foreground mt-0.5">{item.description}</p>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</div>
