<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import { NDKEvent } from '@nostr-dev-kit/ndk';
	import { NDKKind } from '$lib/kinds';
	import { goto } from '$app/navigation';
	import { Trash2, Plus, ArrowLeft, Search, Star, X } from 'lucide-svelte';
	import { User } from '$lib/ndk/ui/user';
	import Portal from 'svelte-portal';
	import { nudgeStore } from '$lib/stores/nudges.svelte';

	// Use the centralized nudge store
	const nudges = $derived(nudgeStore.nudges);
	const savedNudges = $derived(nudgeStore.savedNudges);

	let showCreateModal = $state(false);
	let creating = $state(false);
	let searchQuery = $state('');
	let selectedAuthors = $state<string[]>([]);
	let selectedHashtags = $state<string[]>([]);

	let newNudge = $state({
		title: '',
		description: '',
		content: '',
		tags: ''
	});

	function handleCloseModal() {
		showCreateModal = false;
		newNudge = {
			title: '',
			description: '',
			content: '',
			tags: ''
		};
	}

	async function createNudge() {
		if (!ndk.$currentUser || !newNudge.title.trim() || !newNudge.content.trim()) {
			alert('Please fill in at least title and content');
			return;
		}

		creating = true;
		try {
			const event = new NDKEvent(ndk);
			event.kind = NDKKind.AgentNudge as number;
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
			handleCloseModal();
		} catch (error) {
			console.error('Failed to create nudge:', error);
			alert('Failed to create nudge');
		} finally {
			creating = false;
		}
	}

	function handleModalKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleCloseModal();
		}
	}

	async function deleteNudge(nudge: NDKEvent) {
		if (!ndk.$currentUser || !confirm('Are you sure you want to delete this nudge?')) {
			return;
		}

		try {
			const deletionEvent = new NDKEvent(ndk);
			deletionEvent.kind = NDKKind.EventDeletion;
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

	function toggleSaveNudge(nudgeId: string) {
		nudgeStore.toggleSaved(nudgeId);
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

	function isMyNudge(nudge: NDKEvent): boolean {
		return nudge.pubkey === ndk.$currentUser?.pubkey;
	}

	// Computed values
	const allAuthors = $derived.by(() => {
		const authors = new Set<string>();
		nudges.forEach(n => authors.add(n.pubkey));
		return Array.from(authors);
	});

	const allHashtags = $derived.by(() => {
		const tags = new Set<string>();
		nudges.forEach(n => {
			getNudgeTags(n).forEach(tag => tags.add(tag));
		});
		return Array.from(tags).sort();
	});

	const filteredNudges = $derived.by(() => {
		return nudges.filter(nudge => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const title = getNudgeTitle(nudge).toLowerCase();
				const description = getNudgeDescription(nudge).toLowerCase();
				const content = nudge.content.toLowerCase();
				if (!title.includes(query) && !description.includes(query) && !content.includes(query)) {
					return false;
				}
			}

			// Author filter
			if (selectedAuthors.length > 0 && !selectedAuthors.includes(nudge.pubkey)) {
				return false;
			}

			// Hashtag filter
			if (selectedHashtags.length > 0) {
				const nudgeTags = getNudgeTags(nudge);
				if (!selectedHashtags.some(tag => nudgeTags.includes(tag))) {
					return false;
				}
			}

			return true;
		});
	});

	function toggleAuthorFilter(author: string) {
		if (selectedAuthors.includes(author)) {
			selectedAuthors = selectedAuthors.filter(a => a !== author);
		} else {
			selectedAuthors = [...selectedAuthors, author];
		}
	}

	function toggleHashtagFilter(tag: string) {
		if (selectedHashtags.includes(tag)) {
			selectedHashtags = selectedHashtags.filter(t => t !== tag);
		} else {
			selectedHashtags = [...selectedHashtags, tag];
		}
	}

	function clearFilters() {
		selectedAuthors = [];
		selectedHashtags = [];
		searchQuery = '';
	}
</script>

<svelte:head>
	<title>Agent Nudges - TENEX</title>
</svelte:head>

<div class="flex h-screen bg-background">
	<!-- Sidebar Filters -->
	<div class="w-64 border-r border-border bg-card flex flex-col">
		<div class="p-4 border-b border-border">
			<button
				onclick={() => goto('/')}
				class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
			>
				<ArrowLeft size={16} />
				Back to Projects
			</button>
			<h2 class="font-semibold text-foreground">Filters</h2>
		</div>

		<div class="flex-1 overflow-y-auto p-4 space-y-6">
			<!-- Authors Filter -->
			{#if allAuthors.length > 1}
				<div>
					<h3 class="text-sm font-medium text-foreground mb-2">Authors</h3>
					<div class="space-y-1">
						{#each allAuthors as author}
							{@const isSelected = selectedAuthors.includes(author)}
							<label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent p-1.5 rounded">
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => toggleAuthorFilter(author)}
									class="cursor-pointer"
								/>
								<User.Root {ndk} pubkey={author}>
									<div class="flex items-center gap-2 flex-1 min-w-0">
										<User.Avatar class="w-5 h-5" />
										<User.Name class="truncate text-foreground" />
									</div>
								</User.Root>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Hashtags Filter -->
			{#if allHashtags.length > 0}
				<div>
					<h3 class="text-sm font-medium text-foreground mb-2">Hashtags</h3>
					<div class="flex flex-wrap gap-2">
						{#each allHashtags as tag}
							{@const isSelected = selectedHashtags.includes(tag)}
							<button
								onclick={() => toggleHashtagFilter(tag)}
								class="px-2 py-1 rounded-md text-xs font-medium transition-colors {isSelected
									? 'bg-primary text-primary-foreground'
									: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
							>
								#{tag}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			{#if selectedAuthors.length > 0 || selectedHashtags.length > 0}
				<button
					onclick={clearFilters}
					class="text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					Clear all filters
				</button>
			{/if}
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex flex-col overflow-hidden">
		<!-- Header -->
		<div class="border-b border-border bg-card">
			<div class="p-6">
				<div class="flex items-start justify-between mb-4">
					<div>
						<h1 class="text-2xl font-bold text-foreground">Agent Nudges</h1>
						<p class="text-sm text-muted-foreground mt-1">
							Create and manage system prompt nudges to guide agent behavior
						</p>
					</div>
					<button
						onclick={() => (showCreateModal = true)}
						class="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
					>
						<Plus size={20} />
						New Nudge
					</button>
				</div>

				<!-- Search -->
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search nudges by title, description, or content..."
						class="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					/>
				</div>
			</div>
		</div>

		<!-- Nudge List -->
		<div class="flex-1 overflow-y-auto p-6">
			<div class="max-w-5xl mx-auto">
				{#if filteredNudges.length === 0}
					<div class="text-center py-12 space-y-2">
						{#if searchQuery || selectedAuthors.length > 0 || selectedHashtags.length > 0}
							<p class="text-muted-foreground">No nudges match your filters</p>
							<button
								onclick={clearFilters}
								class="text-sm text-primary hover:underline"
							>
								Clear filters
							</button>
						{:else}
							<p class="text-muted-foreground">No nudges created yet</p>
							<p class="text-sm text-muted-foreground">
								Click "New Nudge" to create your first agent nudge
							</p>
						{/if}
					</div>
				{:else}
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
						{#each filteredNudges as nudge (nudge.id)}
							{@const isMine = isMyNudge(nudge)}
							{@const isSaved = savedNudges.includes(nudge.id)}
							<div class="bg-card border border-border rounded-lg p-4 hover:shadow-md transition-all group">
								<!-- Header -->
								<div class="flex items-start justify-between mb-3">
									<div class="flex-1 min-w-0">
										<h3 class="font-semibold text-foreground flex items-center gap-2">
											{getNudgeTitle(nudge)}
											{#if isSaved && !isMine}
												<Star size={14} class="text-primary fill-primary" />
											{/if}
										</h3>
										{#if getNudgeDescription(nudge)}
											<p class="text-sm text-muted-foreground mt-0.5">
												{getNudgeDescription(nudge)}
											</p>
										{/if}
									</div>
									<div class="flex items-center gap-1">
										{#if !isMine}
											<button
												onclick={() => toggleSaveNudge(nudge.id)}
												class="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
												title={isSaved ? 'Remove from saved' : 'Save for later'}
											>
												<Star size={16} class={isSaved ? 'fill-primary text-primary' : ''} />
											</button>
										{/if}
										{#if isMine}
											<button
												onclick={() => deleteNudge(nudge)}
												class="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
												title="Delete nudge"
											>
												<Trash2 size={16} />
											</button>
										{/if}
									</div>
								</div>

								<!-- Author -->
								<User.Root {ndk} pubkey={nudge.pubkey}>
									<div class="flex items-center gap-2 mb-3 text-xs">
										<User.Avatar class="w-4 h-4" />
										<User.Name class="text-muted-foreground" />
										{#if isMine}
											<span class="text-primary">(you)</span>
										{/if}
									</div>
								</User.Root>

								<!-- Content Preview -->
								<div class="bg-muted/50 border border-border rounded-lg p-3 mb-3">
									<pre class="text-xs font-mono text-foreground whitespace-pre-wrap break-words line-clamp-3">{nudge.content}</pre>
								</div>

								<!-- Tags -->
								{#if getNudgeTags(nudge).length > 0}
									<div class="flex flex-wrap gap-1.5">
										{#each getNudgeTags(nudge) as tag}
											<span class="px-2 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-medium">
												#{tag}
											</span>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Create Nudge Modal -->
	{#if showCreateModal}
		<Portal>
			<div
				class="fixed inset-0 z-[10000] flex items-center justify-center bg-overlay/50"
				onclick={handleCloseModal}
				onkeydown={handleModalKeydown}
				role="presentation"
				tabindex="0"
			>
				<div
					class="relative w-full max-w-lg bg-card rounded-lg shadow-xl flex flex-col max-h-[90vh] mx-4"
					onclick={(e) => e.stopPropagation()}
					role="dialog"
					aria-modal="true"
				>
					<!-- Close Button -->
					<button
						onclick={handleCloseModal}
						class="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10"
						aria-label="Close dialog"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>

					<!-- Header -->
					<div class="px-6 pt-6 pb-4 border-b border-border">
						<h2 class="text-xl font-semibold text-foreground">Create New Nudge</h2>
						<p class="text-sm text-muted-foreground mt-1">
							Add a system prompt snippet to guide agent behavior
						</p>
					</div>

					<!-- Content -->
					<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
						<div class="space-y-1.5">
							<label for="modal-title" class="block text-sm font-medium text-foreground">
								Title *
							</label>
							<input
								id="modal-title"
								type="text"
								bind:value={newNudge.title}
								placeholder="e.g., Funny, Professional, Concise"
								class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="modal-description" class="block text-sm font-medium text-foreground">
								Description
							</label>
							<input
								id="modal-description"
								type="text"
								bind:value={newNudge.description}
								placeholder="Brief description of what this nudge does..."
								class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
							/>
						</div>

						<div class="space-y-1.5">
							<label for="modal-content" class="block text-sm font-medium text-foreground">
								Content *
							</label>
							<textarea
								id="modal-content"
								bind:value={newNudge.content}
								placeholder="The system prompt text that will be injected..."
								rows="6"
								class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
							></textarea>
						</div>

						<div class="space-y-1.5">
							<label for="modal-tags" class="block text-sm font-medium text-foreground">
								Hashtags
							</label>
							<input
								id="modal-tags"
								type="text"
								bind:value={newNudge.tags}
								placeholder="funny, casual, humor"
								class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
							/>
							<p class="text-xs text-muted-foreground">Separate multiple tags with commas</p>
						</div>
					</div>

					<!-- Footer -->
					<div class="px-6 py-4 border-t border-border flex justify-end gap-2">
						<button
							onclick={handleCloseModal}
							class="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
							disabled={creating}
						>
							Cancel
						</button>
						<button
							onclick={createNudge}
							disabled={creating}
							class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{creating ? 'Creating...' : 'Create Nudge'}
						</button>
					</div>
				</div>
			</div>
		</Portal>
	{/if}
</div>

<style>
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
