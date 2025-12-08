<script lang="ts">
	import type { NDKEvent } from '@nostr-dev-kit/ndk';
	import { ConversationState } from '$lib/stores/conversation-state.svelte';
	import { ndk } from '$lib/ndk.svelte';
	import type { Message } from '$lib/utils/messageUtils';
	import * as d3 from 'd3';
	import { onMount } from 'svelte';

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
	let svgElement: SVGElement;
	let nodes = $state<d3.HierarchyPointNode<DelegationNode>[]>([]);
	let links = $state<d3.HierarchyPointLink<DelegationNode>[]>([]);

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
		const messageMap = new Map<string, Message>(messages.map((m) => [m.id, m]));
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

	$effect(() => {
		if (tree && svgElement) {
			const width = svgElement.clientWidth;
			const height = svgElement.clientHeight;
			const root = d3.hierarchy(tree, (d) => d.children);
			const treeLayout = d3.tree<DelegationNode>().size([width, height - 100]);
			const treeData = treeLayout(root);
			nodes = treeData.descendants();
			links = treeData.links();

			const svg = d3.select(svgElement);
			const g = svg.select("g");

			const zoom = d3.zoom().on("zoom", (event) => {
				g.attr("transform", event.transform);
			});

			svg.call(zoom);
		}
	});
</script>

<div class="w-full h-full bg-background p-4 overflow-auto">
	<h2 class="text-lg font-semibold mb-4">Delegation Tree View</h2>
	<div class="w-full h-full" bind:this={svgElement}>
		<svg class="w-full h-full">
			<g transform="translate(0, 50)">
				{#each links as link}
					<path
						class="fill-none stroke-current text-gray-300"
						d={d3.linkVertical()
							.x(d => d.x)
							.y(d => d.y)
							(link)}
					/>
				{/each}
				{#each nodes as node}
					<g transform="translate({node.x}, {node.y})">
						<rect width="200" height="100" rx="10" class="fill-current text-blue-100" />
						<text dy="1.2em" dx="0.5em" class="text-xs fill-current text-gray-800 font-bold">
							{node.data.event.pubkey.substring(0, 16)}
						</text>
						<text dy="2.8em" dx="0.5em" class="text-xs fill-current text-gray-600">
							{node.data.event.content.substring(0, 100)}...
						</text>
					</g>
				{/each}
			</g>
		</svg>
	</div>
</div>
