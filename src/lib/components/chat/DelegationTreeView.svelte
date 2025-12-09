<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ConversationState } from '$lib/stores/conversation-state.svelte';
	import { ndk } from '$lib/ndk.svelte';
	import type { Message } from '$lib/utils/messageUtils';
	import * as d3 from 'd3';

	interface DelegationNode {
		id: string;
		event: NDKEvent;
		children: DelegationNode[];
	}

	interface Props {
		rootEvent: NDKEvent;
	}

	let { rootEvent }: Props = $props();

	let tree = $state<DelegationNode | null>(null);
	let conversationState = $state<ConversationState | null>(null);
	let svgElement: SVGSVGElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();
	let nodes = $state<d3.HierarchyPointNode<DelegationNode>[]>([]);
	let links = $state<d3.HierarchyPointLink<DelegationNode>[]>([]);
	let transform = $state('translate(0, 50)');

	$effect(() => {
		conversationState = new ConversationState(ndk, rootEvent, {
			viewMode: 'flattened',
			directRepliesOnly: false
		});

		conversationState.start();

		return () => {
			conversationState?.destroy();
		};
	});

	const messages = $derived(conversationState?.displayMessages || []);

	function buildTree(messages: Message[], rootId: string): DelegationNode | null {
		const nodeMap = new Map<string, DelegationNode>();

		for (const message of messages) {
			nodeMap.set(message.id, {
				id: message.id,
				event: message.event,
				children: []
			});
		}

		for (const message of messages) {
			const parentTag = message.event.tags.find((t) => t[0] === 'e' && t[3] === 'reply');
			if (parentTag) {
				const parentId = parentTag[1];
				const parentNode = nodeMap.get(parentId);
				const childNode = nodeMap.get(message.id);
				if (parentNode && childNode) {
					parentNode.children.push(childNode);
				}
			}
		}

		return nodeMap.get(rootId) || null;
	}

	$effect(() => {
		if (messages.length > 0) {
			tree = buildTree(messages, rootEvent.id);
		}
	});

	// Layout calculation effect
	$effect(() => {
		if (!tree || !containerElement) return;

		const width = containerElement.clientWidth || 800;
		const height = containerElement.clientHeight || 600;

		const root = d3.hierarchy(tree, (d) => d.children);
		const treeLayout = d3.tree<DelegationNode>().size([width - 250, height - 150]);
		const treeData = treeLayout(root);

		nodes = treeData.descendants();
		links = treeData.links();
	});

	// Zoom/pan effect - separate to avoid recreating on every tree change
	$effect(() => {
		if (!svgElement) return;

		const svg = d3.select(svgElement);

		const zoom = d3.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.1, 4])
			.on('zoom', (event) => {
				transform = event.transform.toString();
			});

		svg.call(zoom);

		// Set initial transform
		svg.call(zoom.transform, d3.zoomIdentity.translate(50, 50));

		return () => {
			svg.on('.zoom', null);
		};
	});

	function linkPath(link: d3.HierarchyPointLink<DelegationNode>): string {
		const path = d3.linkVertical<d3.HierarchyPointLink<DelegationNode>, d3.HierarchyPointNode<DelegationNode>>()
			.x(d => d.x)
			.y(d => d.y);
		return path(link) || '';
	}

	function truncateText(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}
</script>

<div class="flex flex-col h-full bg-background overflow-hidden">
	<div class="px-4 py-2 border-b border-border">
		<h2 class="text-sm font-medium text-muted-foreground">Delegation Tree</h2>
	</div>

	<div class="flex-1 overflow-hidden" bind:this={containerElement}>
		<svg
			bind:this={svgElement}
			class="w-full h-full"
			style="cursor: grab;"
		>
			<g {transform}>
				{#each links as link (link.source.data.id + '-' + link.target.data.id)}
					<path
						class="fill-none stroke-muted-foreground/30"
						stroke-width="2"
						d={linkPath(link)}
					/>
				{/each}
				{#each nodes as node (node.data.id)}
					<g transform="translate({node.x - 100}, {node.y})">
						<rect
							width="200"
							height="80"
							rx="8"
							class="fill-card stroke-border"
							stroke-width="1"
						/>
						<text
							dy="1.5em"
							dx="0.75em"
							class="text-xs fill-muted-foreground font-mono"
						>
							{node.data.event.pubkey.substring(0, 12)}...
						</text>
						<foreignObject x="8" y="28" width="184" height="44">
							<div class="text-xs text-foreground line-clamp-2 overflow-hidden">
								{truncateText(node.data.event.content, 80)}
							</div>
						</foreignObject>
					</g>
				{/each}
			</g>
		</svg>
	</div>
</div>
