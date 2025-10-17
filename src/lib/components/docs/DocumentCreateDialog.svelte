<script lang="ts">
	import { ndk } from '$lib/ndk.svelte';
	import type { NDKProject } from '$lib/events/NDKProject';
	import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
	import { X, Loader2, FileText, Trash2, Hash as HashIcon } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface Props {
		open: boolean;
		project: NDKProject;
		onClose: () => void;
	}

	let { open = $bindable(), project, onClose }: Props = $props();

	let title = $state('');
	let content = $state('');
	let hashtags = $state<string[]>([]);
	let hashtagInput = $state('');
	let isPublishing = $state(false);
	let draftLoaded = $state(false);

	let titleTextarea: HTMLTextAreaElement;
	let contentTextarea: HTMLTextAreaElement;

	const draftKey = $derived(`doc-draft-${project.dTag}`);

	// Auto-resize title textarea
	function resizeTitleTextarea() {
		if (titleTextarea) {
			titleTextarea.style.height = 'auto';
			titleTextarea.style.height = titleTextarea.scrollHeight + 'px';
		}
	}

	$effect(() => {
		title;
		resizeTitleTextarea();
	});

	// Load draft on mount
	onMount(() => {
		if (open) {
			const savedDraft = localStorage.getItem(draftKey);
			if (savedDraft) {
				try {
					const draft = JSON.parse(savedDraft);
					if (draft.title || draft.content || draft.hashtags?.length > 0) {
						title = draft.title || '';
						content = draft.content || '';
						hashtags = draft.hashtags || [];
						draftLoaded = true;
					}
				} catch (e) {
					console.error('Failed to load draft:', e);
				}
			}
		}
	});

	// Save draft to localStorage
	$effect(() => {
		if (title || content || hashtags.length > 0) {
			const draft = { title, content, hashtags };
			localStorage.setItem(draftKey, JSON.stringify(draft));
		}
	});

	function clearDraft() {
		title = '';
		content = '';
		hashtags = [];
		draftLoaded = false;
		localStorage.removeItem(draftKey);
	}

	function handleHashtagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
			e.preventDefault();
			const tag = hashtagInput.trim().replace(/^#/, '');
			if (tag && !hashtags.includes(tag) && hashtags.length < 5) {
				hashtags = [...hashtags, tag];
				hashtagInput = '';
			}
		} else if (e.key === 'Backspace' && !hashtagInput && hashtags.length > 0) {
			hashtags = hashtags.slice(0, -1);
		}
	}

	function removeHashtag(tag: string) {
		hashtags = hashtags.filter((t) => t !== tag);
	}

	async function handlePublish() {
		const currentUser = ndk.$sessions.currentUser;
		if (!currentUser || !title || !content) {
			return;
		}

		isPublishing = true;

		try {
			const article = new NDKEvent(ndk);
			article.kind = 30023 as NDKKind;

			// Auto-generate summary from content (first 160 chars)
			const summary =
				content.slice(0, 160).trim() + (content.length > 160 ? '...' : '');

			// Build tags
			const identifier = `${project.tagId()}-${Date.now()}`;
			article.tags = [
				['d', identifier],
				['title', title],
				['a', project.tagId()]
			];

			if (summary) {
				article.tags.push(['summary', summary]);
			}

			hashtags.forEach((tag) => {
				article.tags.push(['t', tag]);
			});

			const publishedAt = Math.floor(Date.now() / 1000);
			article.tags.push(['published_at', String(publishedAt)]);

			article.content = content;
			article.created_at = publishedAt;

			await article.publish();

			// Clear form and draft
			clearDraft();
			onClose();
		} catch (error) {
			console.error('Failed to publish article:', error);
		} finally {
			isPublishing = false;
		}
	}

	function handleClose() {
		onClose();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
		onclick={handleClose}
	>
		<div
			class="w-full h-full bg-card flex flex-col"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between px-6 py-4 border-b border-border"
			>
				<button
					type="button"
					onclick={handleClose}
					class="p-2 hover:bg-accent rounded transition-colors"
				>
					<X class="h-4 w-4" />
				</button>

				<div class="flex items-center gap-3">
					{#if title || content || hashtags.length > 0}
						<span class="text-xs text-muted-foreground">Draft saved</span>
					{/if}
					<button
						type="button"
						onclick={handlePublish}
						disabled={!title || !content || isPublishing}
						class="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded transition-colors disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if isPublishing}
							<Loader2 class="h-3 w-3 animate-spin" />
							<span>Publishing...</span>
						{:else}
							<span>Publish</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Draft notification -->
			{#if draftLoaded}
				<div
					class="bg-accent border-b border-border px-6 py-2 flex items-center justify-between"
				>
					<div class="flex items-center gap-2 text-sm">
						<FileText class="h-4 w-4" />
						<span>Restored from draft</span>
					</div>
					<button
						type="button"
						onclick={clearDraft}
						class="text-xs hover:bg-accent px-2 py-1 rounded transition-colors flex items-center gap-1"
					>
						<Trash2 class="h-3 w-3" />
						<span>Start fresh</span>
					</button>
				</div>
			{/if}

			<!-- Content -->
			<div class="flex-1 overflow-y-auto">
				<div class="max-w-[680px] mx-auto px-5 py-4">
					<!-- Title -->
					<textarea
						bind:this={titleTextarea}
						bind:value={title}
						placeholder="Title"
						class="w-full resize-none border-0 outline-none bg-transparent text-3xl font-bold placeholder:text-muted-foreground overflow-hidden"
						style="min-height: 50px"
						rows="1"
					></textarea>

					<!-- Hashtags -->
					<div class="mt-4 mb-6 pb-4 border-b border-border">
						<div class="flex items-center gap-2 flex-wrap">
							{#each hashtags as tag (tag)}
								<div
									class="inline-flex items-center gap-1 px-2 py-1 text-sm bg-muted rounded"
								>
									<HashIcon class="h-3 w-3" />
									<span>{tag}</span>
									<button
										type="button"
										onclick={() => removeHashtag(tag)}
										class="ml-1 hover:text-red-600 transition-colors"
									>
										<X class="h-3 w-3" />
									</button>
								</div>
							{/each}
							{#if hashtags.length < 5}
								<input
									type="text"
									bind:value={hashtagInput}
									onkeydown={handleHashtagKeydown}
									placeholder="Add up to 5 tags..."
									class="flex-1 min-w-[150px] px-2 py-1 text-sm border-0 outline-none bg-transparent placeholder:text-muted-foreground"
								/>
							{/if}
						</div>
					</div>

					<!-- Content editor -->
					<textarea
						bind:this={contentTextarea}
						bind:value={content}
						placeholder="Tell your story in markdown...

Use markdown syntax:
# Heading 1
## Heading 2
**bold**, *italic*
- Lists
> Quotes
[links](url)
`code`"
						class="w-full min-h-[400px] resize-none border-0 outline-none bg-transparent text-lg leading-relaxed placeholder:text-muted-foreground font-serif"
					></textarea>
				</div>
			</div>
		</div>
	</div>
{/if}
