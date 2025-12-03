import { NDKEvent, type NostrEvent } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

/**
 * NDKAgentDefinitionPack represents a collection of agent definitions.
 * This allows users to create curated packs of agents for specific workflows.
 *
 * Event kind: 34199 (NIP-33 replaceable)
 *
 * Tags:
 * - d: Unique identifier for this pack (slug)
 * - title: Pack name
 * - image: Cover image URL
 * - e: Event IDs of agent definitions in this pack
 * - t: Hashtags for categorization
 *
 * Content: Description of the pack
 */
export class NDKAgentDefinitionPack extends NDKEvent {
	static kind = 34199;
	static kinds = [34199];

	constructor(ndk?: NDK, rawEvent?: NostrEvent | NDKEvent) {
		super(ndk, rawEvent);
		this.kind ??= NDKAgentDefinitionPack.kind;
	}

	static from(event: NDKEvent) {
		return new NDKAgentDefinitionPack(event.ndk, event);
	}

	get title(): string | undefined {
		return this.tagValue('title');
	}

	set title(value: string | undefined) {
		this.removeTag('title');
		if (value) {
			this.tags.push(['title', value]);
		}
	}

	get description(): string {
		return this.content;
	}

	set description(value: string) {
		this.content = value;
	}

	get image(): string | undefined {
		return this.tagValue('image') || this.tagValue('picture');
	}

	set image(value: string | undefined) {
		this.removeTag('image');
		this.removeTag('picture');
		if (value) {
			this.tags.push(['image', value]);
		}
	}

	get agentEventIds(): string[] {
		return this.tags.filter((tag) => tag[0] === 'e').map((tag) => tag[1]);
	}

	addAgent(agentDefinition: NDKEvent): void {
		this.tag(agentDefinition);
	}

	removeAgent(agentDefinition: NDKEvent): void {
		this.tags = this.tags.filter((tag) => !(tag[0] === 'e' && tag[1] === agentDefinition.id));
	}

	get hashtags(): string[] {
		return this.tags.filter((tag) => tag[0] === 't').map((tag) => tag[1]);
	}

	set hashtags(tags: string[]) {
		this.tags = this.tags.filter((tag) => tag[0] !== 't');
		tags.forEach((tag) => {
			this.tags.push(['t', tag]);
		});
	}

	get dTag(): string | undefined {
		const existingDTag = this.tagValue('d');
		if (existingDTag) return existingDTag;

		if (this.title) {
			return this.title.toLowerCase().replace(/\s+/g, '-');
		}

		return undefined;
	}

	set dTag(value: string | undefined) {
		this.removeTag('d');
		if (value) {
			this.tags.push(['d', value]);
		}
	}

	nip33TagReference(): string | undefined {
		if (!this.pubkey || !this.dTag) return undefined;
		return `${this.kind}:${this.pubkey}:${this.dTag}`;
	}

	override tagId(): string {
		return this.nip33TagReference() || '';
	}
}
