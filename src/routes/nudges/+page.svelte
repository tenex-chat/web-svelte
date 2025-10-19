<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { onMount } from 'svelte';
	import { Trash2, Plus } from 'lucide-svelte';

	let nudges = $state<NDKEvent[]>([]);
	let loading = $state(true);
	let showCreateForm = $state(false);
	let newNudge = $state({
		title: '',
		description: '',
		content: '',
		tags: ''
	});

	onMount(async () => {
		await fetchNudges();
	});

	async function fetchNudges() {
		loading = true;
		try {
			const nudgeEvents = await ndk.fetchEvents({
				kinds: [NDKKind.AgentNudge]
			});

			nudges = Array.from(nudgeEvents).sort((a, b) => {
				const aTime = a.created_at || 0;
				const bTime = b.created_at || 0;
				return bTime - aTime;
			});
		} catch (error) {
			console.error('Failed to fetch nudges:', error);
		} finally {
			loading = false;
		}
	}

	async function createNudge() {
		if (!ndk.$currentUser || !newNudge.title.trim() || !newNudge.content.trim()) {
			alert('Please fill in at least title and content');
			return;
		}

		try {
			const event = new NDKEvent(ndk);
			event.kind = NDKKind.AgentNudge;
			event.content = newNudge.content.trim();

			event.tags.push(['title', newNudge.title.trim()]);

			if (newNudge.description.trim()) {
				event.tags.push(['description', newNudge.description.trim()]);
			}

			if (newNudge.tags.trim()) {
				const tagList = newNudge.tags
					.split(',')
					.map((t) => t.trim())
					.filter((t) => t);
				for (const tag of tagList) {
					event.tags.push(['t', tag]);
				}
			}

			await event.sign();
			await event.publish();

			newNudge = { title: '', description: '', content: '', tags: '' };
			showCreateForm = false;
			await fetchNudges();
		} catch (error) {
			console.error('Failed to create nudge:', error);
			alert('Failed to create nudge');
		}
	}

	async function deleteNudge(nudge: NDKEvent) {
		if (!ndk.$currentUser || !confirm('Are you sure you want to delete this nudge?')) {
			return;
		}

		try {
			const deletionEvent = new NDKEvent(ndk);
			deletionEvent.kind = 5 as NDKKind;
			deletionEvent.content = 'Deleted nudge';
			deletionEvent.tags.push(['e', nudge.id]);
			deletionEvent.tags.push(['k', '4201']);

			await deletionEvent.sign();
			await deletionEvent.publish();

			nudges = nudges.filter((n) => n.id !== nudge.id);
		} catch (error) {
			console.error('Failed to delete nudge:', error);
			alert('Failed to delete nudge');
		}
	}

	function getNudgeTitle(nudge: NDKEvent): string {
		return nudge.tagValue('title') || 'Untitled Nudge';
	}

	function getNudgeDescription(nudge: NDKEvent): string {
		return nudge.tagValue('description') || '';
	}

	function getNudgeTags(nudge: NDKEvent): string[] {
		return nudge.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]);
	}
</script>

<svelte:head>
	<title>Agent Nudges - TENEX</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-6 space-y-6">
	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Agent Nudges</h1>
			<p class="text-sm text-muted-foreground mt-1">
				Create and manage system prompt nudges to guide agent behavior
			</p>
		</div>
		<button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
		>
			<Plus size={20} />
			{showCreateForm ? 'Cancel' : 'New Nudge'}
		</button>
	</div>

	<!-- Create Form -->
	{#if showCreateForm}
		<div class="bg-card border border-border rounded-lg p-6 space-y-4">
			<h2 class="text-lg font-semibold text-foreground">Create New Nudge</h2>

			<div class="space-y-1.5">
				<label for="title" class="block text-sm font-medium text-foreground">Title *</label>
				<input
					id="title"
					type="text"
					bind:value={newNudge.title}
					placeholder="e.g., Funny, Professional, Concise"
					class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="description" class="block text-sm font-medium text-foreground"
					>Description</label
				>
				<input
					id="description"
					type="text"
					bind:value={newNudge.description}
					placeholder="What does this nudge do?"
					class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>

			<div class="space-y-1.5">
				<label for="content" class="block text-sm font-medium text-foreground">Content *</label>
				<textarea
					id="content"
					bind:value={newNudge.content}
					placeholder="always finish your messages with a joke"
					rows="4"
					class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y"
				></textarea>
			</div>

			<div class="space-y-1.5">
				<label for="tags" class="block text-sm font-medium text-foreground"
					>Tags (comma-separated)</label
				>
				<input
					id="tags"
					type="text"
					bind:value={newNudge.tags}
					placeholder="funny, casual, humor"
					class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				/>
			</div>

			<button
				onclick={createNudge}
				class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
			>
				Create Nudge
			</button>
		</div>
	{/if}

	<!-- Nudge List -->
	<div class="space-y-3">
		{#if loading}
			<div class="text-center py-12 text-muted-foreground">Loading nudges...</div>
		{:else if nudges.length === 0}
			<div class="text-center py-12 space-y-2">
				<p class="text-muted-foreground">No nudges created yet</p>
				<p class="text-sm text-muted-foreground">
					Click "New Nudge" to create your first agent nudge
				</p>
			</div>
		{:else}
			{#each nudges as nudge (nudge.id)}
				<div
					class="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
				>
					<div class="flex items-start justify-between mb-3">
						<div class="flex-1">
							<h3 class="font-semibold text-foreground">{getNudgeTitle(nudge)}</h3>
							{#if getNudgeDescription(nudge)}
								<p class="text-sm text-muted-foreground mt-0.5">
									{getNudgeDescription(nudge)}
								</p>
							{/if}
						</div>
						<button
							onclick={() => deleteNudge(nudge)}
							class="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
							title="Delete nudge"
						>
							<Trash2 size={18} />
						</button>
					</div>

					<div class="bg-muted/50 border border-border rounded-lg p-3 mb-3">
						<pre
							class="text-sm font-mono text-foreground whitespace-pre-wrap break-words">{nudge.content}</pre>
					</div>

					{#if getNudgeTags(nudge).length > 0}
						<div class="flex flex-wrap gap-2 mb-3">
							{#each getNudgeTags(nudge) as tag}
								<span
									class="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs font-medium"
								>
									#{tag}
								</span>
							{/each}
						</div>
					{/if}

					<div class="pt-3 border-t border-border">
						<span class="text-xs font-mono text-muted-foreground">
							ID: {nudge.id.substring(0, 16)}...
						</span>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
