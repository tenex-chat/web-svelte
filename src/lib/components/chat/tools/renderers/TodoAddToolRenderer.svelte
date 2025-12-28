<script lang="ts">
	import { ListTodo, Plus } from 'lucide-svelte';

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

<div class="text-sm">
	<div class="flex items-center gap-2 text-muted-foreground mb-2">
		<ListTodo class="w-4 h-4 flex-shrink-0" />
		<Plus class="w-3 h-3 flex-shrink-0" />
		<span>{content || `Adding ${items.length} todo${items.length !== 1 ? 's' : ''}`}</span>
	</div>

	{#if items.length > 0}
		<ul class="ml-6 space-y-1.5">
			{#each items as item}
				<li class="text-muted-foreground">
					<span class="font-medium text-foreground">{item.title}</span>
					{#if item.description}
						<span class="text-xs ml-2">— {item.description}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
