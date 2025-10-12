import { NDKEvent, type NDKKind, type NostrEvent } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';

export interface ProjectAgent {
	pubkey: string;
	name: string;
	isGlobal?: boolean;
	model?: string;
	status?: string;
	lastSeen?: number;
	tools?: string[];
}

export interface ProjectModel {
	provider: string;
	name: string;
}

export class NDKProjectStatus extends NDKEvent {
	static kind: NDKKind = 24010 as NDKKind;
	static kinds = [24010];

	constructor(ndk?: NDK, rawEvent?: NostrEvent | NDKEvent) {
		super(ndk, rawEvent);
		this.kind = NDKProjectStatus.kind;
		if (!this.tags) {
			this.tags = [];
		}
		if (!this.content) {
			this.content = '';
		}
	}

	get projectId(): string | undefined {
		const aTag = this.tagValue('a');
		if (aTag) return aTag;
		return this.tagValue('e');
	}

	set projectId(value: string | undefined) {
		this.removeTag('a');
		this.removeTag('e');

		if (value) {
			if (value.includes(':')) {
				this.tags.push(['a', value]);
			} else {
				this.tags.push(['e', value]);
			}
		}
	}

	get isOnline(): boolean {
		if (!this.created_at) return false;
		const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
		return this.created_at > fiveMinutesAgo;
	}

	get lastSeen(): Date | undefined {
		return this.created_at ? new Date(this.created_at * 1000) : undefined;
	}

	get agents(): ProjectAgent[] {
		const agents: ProjectAgent[] = [];
		const agentMap = new Map<string, ProjectAgent>();

		// First pass: build agents from agent tags
		for (const tag of this.tags) {
			if (tag[0] === 'agent' && tag[1]) {
				const agent: ProjectAgent = {
					pubkey: tag[1],
					name: tag[2] || 'Unknown',
					isGlobal: tag[3] === 'global',
					tools: []
				};
				agents.push(agent);
				agentMap.set(agent.name, agent);
			}
		}

		// Second pass: add models to agents from model tags
		for (const tag of this.tags) {
			if (tag[0] === 'model' && tag[1]) {
				const modelSlug = tag[1];
				for (let i = 2; i < tag.length; i++) {
					const agentName = tag[i];
					const agent = agentMap.get(agentName);
					if (agent) {
						agent.model = modelSlug;
					}
				}
			}
		}

		// Third pass: add tools to agents from tool tags
		for (const tag of this.tags) {
			if (tag[0] === 'tool' && tag[1]) {
				const toolName = tag[1];
				for (let i = 2; i < tag.length; i++) {
					const agentName = tag[i];
					const agent = agentMap.get(agentName);
					if (agent) {
						if (!agent.tools) agent.tools = [];
						agent.tools.push(toolName);
					}
				}
			}
		}

		return agents;
	}

	set agents(agentList: ProjectAgent[]) {
		this.tags = this.tags.filter(
			(tag) => tag[0] !== 'agent' && tag[0] !== 'model' && tag[0] !== 'tool'
		);

		for (const agent of agentList) {
			const tag = ['agent', agent.pubkey, agent.name];
			if (agent.isGlobal) tag.push('global');
			this.tags.push(tag);
		}

		const modelMap = new Map<string, string[]>();
		for (const agent of agentList) {
			if (agent.model) {
				if (!modelMap.has(agent.model)) {
					modelMap.set(agent.model, []);
				}
				const modelAgents = modelMap.get(agent.model);
				if (modelAgents) {
					modelAgents.push(agent.name);
				}
			}
		}

		for (const [modelSlug, agentNames] of modelMap) {
			this.tags.push(['model', modelSlug, ...agentNames]);
		}

		const toolMap = new Map<string, string[]>();
		for (const agent of agentList) {
			if (agent.tools && agent.tools.length > 0) {
				for (const tool of agent.tools) {
					if (!toolMap.has(tool)) {
						toolMap.set(tool, []);
					}
					const toolAgents = toolMap.get(tool);
					if (toolAgents) {
						toolAgents.push(agent.name);
					}
				}
			}
		}

		for (const [toolName, agentNames] of toolMap) {
			this.tags.push(['tool', toolName, ...agentNames]);
		}
	}

	get models(): ProjectModel[] {
		const models: ProjectModel[] = [];
		const modelSet = new Set<string>();

		for (const tag of this.tags) {
			if (tag[0] === 'model' && tag[1]) {
				const modelSlug = tag[1];
				if (!modelSet.has(modelSlug)) {
					modelSet.add(modelSlug);
					models.push({
						provider: modelSlug,
						name: modelSlug
					});
				}
			}
		}
		return models;
	}

	set models(modelList: ProjectModel[]) {
		this.tags = this.tags.filter((tag) => tag[0] !== 'model');

		for (const model of modelList) {
			this.tags.push(['model', model.name]);
		}
	}

	static from(event: NDKEvent): NDKProjectStatus {
		return new NDKProjectStatus(event.ndk, event.rawEvent());
	}
}
