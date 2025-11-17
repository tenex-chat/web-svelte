import { describe, it, expect, beforeEach } from 'vitest';
import { NDKEvent } from '@nostr-dev-kit/ndk';
import { NDKSvelte } from '@nostr-dev-kit/svelte';
import { ConversationState } from './conversation-state.svelte';

describe('ConversationState - Threading Bug', () => {
	let ndk: NDKSvelte;

	beforeEach(() => {
		// Create a minimal NDK instance
		ndk = new NDKSvelte({
			explicitRelayUrls: ['wss://tenex.chat/']
		});
	});

	it('should NOT include root event in displayMessages when directRepliesOnly=true', () => {
		// Create real NDKEvent objects from the provided JSON data
		const rootEventData = {
			created_at: 1763301994,
			content: 'what tools do you have?',
			tags: [
				['title', 'what tools do you have?'],
				['a', '31933:09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7:TENEX-Web-Svelte-ow3jsn', '', ''],
				['p', '3fe5656ef0654ee4f8335c208d604a10b5693cb73a38f6338f861179ae40a100']
			],
			kind: 11,
			pubkey: '09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7',
			id: '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31',
			sig: '80ebee2429aa4c7cd81a2d4e8ed7cb279b04fc4779a43587938003ed6efab0ac6af1b4be60e740a057c925022153245d9e8191da2c315a3631cd4a8886f1c4c4'
		};

		const typingIndicatorData = {
			created_at: 1763301994,
			content: 'Execution Coordinator is typing',
			tags: [
				['E', '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31'],
				['K', '11'],
				['P', '09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7'],
				['e', '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31'],
				['a', '31933:09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7:TENEX-Web-Svelte-ow3jsn', 'wss://tenex.chat/', ''],
				['llm-model', 'default']
			],
			kind: 24111,
			pubkey: '3fe5656ef0654ee4f8335c208d604a10b5693cb73a38f6338f861179ae40a100',
			id: '51643bfa11fb142a13bb11b679e8177235d6990fa085d4a66b5a8e4ea6e3bc62',
			sig: '3e0a641f0fff4ba1b1770bd6cfaadd2e30f1f781194b38bc40625d9a354c6e074c63ac62ddf39014efbb5d94f4c5e1b4446cfe53992124aa8ec2a39ba8a19e4c'
		};

		const reasoningMessageData = {
			created_at: 1763301997,
			content: "I'M DONE: The request was \"what tools do you have?\". I fully addressed this by listing all my available tools. No implementation or review was necessary for this specific request.",
			tags: [
				['E', '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31'],
				['K', '11'],
				['P', '09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7'],
				['e', '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31'],
				['reasoning'],
				['a', '31933:09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7:TENEX-Web-Svelte-ow3jsn', 'wss://tenex.chat/', ''],
				['llm-model', 'default']
			],
			kind: 1111,
			pubkey: '3fe5656ef0654ee4f8335c208d604a10b5693cb73a38f6338f861179ae40a100',
			id: '7635fe32ccab4e44d626404a0428f8eb83b9a7d3af74f249d6bbc4e1016f53de',
			sig: 'be8544593a8d3a9dc5c7275fd30754f20897b21150f06bd07b0c304f8b95d34c1fb71b920f10d5d4a456b57e0b46052d40b895c26fc6814ee7f313a7d5214880'
		};

		const responseMessageData = {
			created_at: 1763301998,
			content: 'I have the following tools:\n\n- **lesson_get**: Retrieve lessons learned from previous work by title.\n- **lesson_learn**: Record new lessons and insights for future reference.\n- **read_path**: Read a file or directory from the filesystem.\n- **codebase_search**: Searches the project codebase for files, directories, or content.\n- **reports_list**: List NDKArticle reports from agents in the project.\n- **report_read**: Read a report by slug or naddr identifier.\n- **rag_query**: Perform semantic search on a RAG collection.\n- **rag_add_documents**: Add documents to a RAG collection.\n- **rag_create_collection**: Create a new RAG collection.\n- **rag_delete_collection**: Delete a RAG collection.\n- **rag_list_collections**: List all available RAG collections.\n- **ask**: Ask a question to the project owner and wait for their response.\n- **delegate_phase**: Switch conversation phase and delegate a question or task to one or more agents.\n- **phase_add**: Add a new phase definition to your agent configuration.\n- **phase_remove**: Remove a phase definition from your agent configuration.\n- **delegate_external**: Delegate a task to an external agent or user.\n- **delegate_followup**: Send a follow-up question to an agent you previously delegated to.\n\nThese tools allow me to manage phases, delegate tasks, interact with the project owner, manage RAG collections, read and search the codebase, and learn from past experiences.',
			tags: [
				['E', '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31'],
				['K', '11'],
				['P', '09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7'],
				['e', '9a425dd000a59fefee067c17303bbc5e294c53ba0ac8e4f9ab84b0b48bfcea31'],
				['p', '09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7'],
				['status', 'completed'],
				['llm-prompt-tokens', '3110'],
				['llm-completion-tokens', '332'],
				['llm-total-tokens', '3442'],
				['llm-cost-usd', '0.00174537'],
				['llm-reasoning-tokens', '0'],
				['llm-cached-input-tokens', '0'],
				['a', '31933:09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7:TENEX-Web-Svelte-ow3jsn', 'wss://tenex.chat/', ''],
				['llm-model', 'default']
			],
			kind: 1111,
			pubkey: '3fe5656ef0654ee4f8335c208d604a10b5693cb73a38f6338f861179ae40a100',
			id: 'fdd40f324423bfcd5daa65e3d9174caab34247595022006fcbc82f274402baf1',
			sig: '8ab6da1d2671d4d439f1945d4c9d0d6df0fc978e284dcec12031a3ce4bf34d6c275646b84e4cf1b0d95a39521a05bbda98e05b8a98149487e0fd927e298d6c81'
		};

		// Create actual NDKEvent instances
		const rootEvent = new NDKEvent(ndk, rootEventData);
		const typingIndicator = new NDKEvent(ndk, typingIndicatorData);
		const reasoningMessage = new NDKEvent(ndk, reasoningMessageData);
		const responseMessage = new NDKEvent(ndk, responseMessageData);

		// Create ConversationState with directRepliesOnly=true (as ThreadedMessage does)
		const conversationState = new ConversationState(ndk, rootEvent, {
			viewMode: 'threaded',
			isBrainstorm: false,
			directRepliesOnly: true,
			debug: false
		});

		// Don't call start() which would try to create subscriptions
		// Instead, directly add the root event to messages as start() would do
		// This simulates what happens in the current buggy code
		if (!conversationState['messages'].has(rootEvent.id)) {
			conversationState['messages'].set(rootEvent.id, {
				id: rootEvent.id,
				event: rootEvent
			});
		}

		// Manually process the reply events (simulating subscription delivery)
		conversationState['processEvent'](typingIndicator);
		conversationState['processEvent'](reasoningMessage);
		conversationState['processEvent'](responseMessage);

		// Get displayMessages
		const displayMessages = conversationState.displayMessages;

		// ASSERTIONS
		// BUG: Currently displayMessages will include the root event + 2 replies = 3 items
		// EXPECTED: displayMessages should ONLY have the 2 reply messages, NOT the root

		console.log('Root event ID:', rootEvent.id.substring(0, 8));
		console.log('Display messages:', displayMessages.map(m => ({
			id: m.id.substring(0, 8),
			isRoot: m.id === rootEvent.id
		})));

		// This test should FAIL initially (before fix)
		expect(displayMessages.length).toBe(2); // Should be 2, not 3
		expect(displayMessages.some(m => m.id === rootEvent.id)).toBe(false); // Root should NOT be in replies
		expect(displayMessages.some(m => m.id === reasoningMessage.id)).toBe(true);
		expect(displayMessages.some(m => m.id === responseMessage.id)).toBe(true);
	});
});
