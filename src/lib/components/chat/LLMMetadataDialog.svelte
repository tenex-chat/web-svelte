<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { Info, X, Cpu, Zap, Settings, Activity } from 'lucide-svelte';

	interface Props {
		event: NDKEvent;
		onClose: () => void;
	}

	let { event, onClose }: Props = $props();

	// Extract LLM metadata from event tags
	const metadata = $derived.by(() => {
		const tags = event.tags;
		const data: Record<string, string> = {};

		// Extract all llm-* prefixed tags
		for (const tag of tags) {
			const tagName = tag[0];
			const tagValue = tag[1];

			if (!tagValue) continue;

			// Extract all llm-* tags
			if (tagName.startsWith('llm-')) {
				const key = tagName.slice(4); // Remove 'llm-' prefix
				data[key] = tagValue;
			}
		}

		return data;
	});

	const hasMetadata = $derived(Object.keys(metadata).length > 0);

	// Group metadata by category
	const groupedMetadata = $derived.by(() => {
		return {
			model: {
				icon: Cpu,
				title: 'Model Information',
				items: [
					{ key: 'model', label: 'Model', value: metadata.model },
					{ key: 'provider', label: 'Provider', value: metadata.provider },
					{ key: 'api-version', label: 'API Version', value: metadata['api-version'] },
					{ key: 'system-fingerprint', label: 'System Fingerprint', value: metadata['system-fingerprint'] }
				].filter((item) => item.value)
			},
			parameters: {
				icon: Settings,
				title: 'Generation Parameters',
				items: [
					{ key: 'temperature', label: 'Temperature', value: metadata.temperature },
					{ key: 'max-tokens', label: 'Max Tokens', value: metadata['max-tokens'] },
					{ key: 'top-p', label: 'Top P', value: metadata['top-p'] },
					{ key: 'frequency-penalty', label: 'Frequency Penalty', value: metadata['frequency-penalty'] },
					{ key: 'presence-penalty', label: 'Presence Penalty', value: metadata['presence-penalty'] }
				].filter((item) => item.value)
			},
			usage: {
				icon: Activity,
				title: 'Token Usage',
				items: [
					{ key: 'prompt-tokens', label: 'Prompt Tokens', value: metadata['prompt-tokens'] },
					{ key: 'completion-tokens', label: 'Completion Tokens', value: metadata['completion-tokens'] },
					{ key: 'total-tokens', label: 'Total Tokens', value: metadata['total-tokens'] },
					{ key: 'reasoning-tokens', label: 'Reasoning Tokens', value: metadata['reasoning-tokens'] },
					{ key: 'cached-input-tokens', label: 'Cached Input Tokens', value: metadata['cached-input-tokens'] }
				].filter((item) => item.value)
			},
			performance: {
				icon: Zap,
				title: 'Performance',
				items: [
					{ key: 'response-time', label: 'Response Time', value: metadata['response-time'] ? `${metadata['response-time']}ms` : undefined },
					{ key: 'finish-reason', label: 'Finish Reason', value: metadata['finish-reason'] },
					{ key: 'cost-usd', label: 'Cost (USD)', value: metadata['cost-usd'] ? `$${metadata['cost-usd']}` : undefined }
				].filter((item) => item.value)
			}
		};
	});

	function copyMetadata() {
		const text = JSON.stringify(metadata, null, 2);
		navigator.clipboard.writeText(text);
	}
</script>

<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		onclick={onClose}
		onkeydown={(e) => {
			if (e.key === 'Escape') onClose();
		}}
		role="dialog"
		aria-modal="true"
		aria-labelledby="llm-metadata-title"
		tabindex="-1"
	>
		<div
			class="bg-card rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-border">
				<div class="flex items-center gap-2">
					<Info class="w-5 h-5 text-primary" />
					<h3 id="llm-metadata-title" class="font-semibold text-foreground">
						LLM Metadata
					</h3>
				</div>
				<button
					type="button"
					onclick={onClose}
					class="p-1 rounded hover:bg-muted transition-colors"
					aria-label="Close"
				>
					<X class="w-5 h-5 text-muted-foreground" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-4">
				{#if !hasMetadata}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<Info class="w-12 h-12 text-muted-foreground mb-3" />
						<p class="text-muted-foreground text-sm">
							No LLM metadata found for this message
						</p>
						<p class="text-muted-foreground text-xs mt-1">
							Metadata is typically attached by AI agents when generating responses
						</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each Object.entries(groupedMetadata) as [, category]}
							{#if category.items.length > 0}
								<div class="border border-border rounded-lg p-4">
									<div class="flex items-center gap-2 mb-3">
										<svelte:component
											this={category.icon}
											class="w-4 h-4 text-primary dark:text-blue-400"
										/>
										<h4 class="font-medium text-sm text-foreground">
											{category.title}
										</h4>
									</div>
									<dl class="space-y-2">
										{#each category.items as item (item.key)}
											<div class="flex items-start justify-between gap-4 text-sm">
												<dt class="text-muted-foreground font-medium min-w-[140px]">
													{item.label}:
												</dt>
												<dd class="text-foreground font-mono text-xs break-all">
													{item.value}
												</dd>
											</div>
										{/each}
									</dl>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if hasMetadata}
				<div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
					<button
						type="button"
						onclick={copyMetadata}
						class="px-3 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 transition-colors"
					>
						Copy JSON
					</button>
				</div>
			{/if}
		</div>
	</div>
