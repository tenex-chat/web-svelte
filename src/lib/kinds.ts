/**
 * Centralized event kind definitions for TENEX.
 *
 * This module extends NDK's NDKKind enum with custom Tenex event kinds.
 * All kind references throughout the codebase should use this module instead
 * of importing NDKKind directly or using magic numbers.
 */

import { NDKKind as BaseNDKKind } from "@nostr-dev-kit/ndk";

// Re-export all base NDK kinds
export const NDKKind = {
    ...BaseNDKKind,

    // Standard NIP kinds not in NDK
    AgentRequest: 3199,
    AgentRequestList: 13199,
    AgentNudge: 4201,
    AgentDefinition: 4199,
    AgentDefinitionPack: 34199,

    // Tenex custom kinds (2xxxx range)
    TenexStreamingResponse: 21111,
    TenexProjectStatus: 24010,
    TenexAgentConfigUpdate: 24020,
    TenexAgentTypingStart: 24111,
    TenexAgentTypingStop: 24112,
    TenexOperationsStatus: 24133,
    TenexStopCommand: 24134,
    TenexProjectStart: 24000,
    TenexLLMConfigChange: 24101,
    TenexConversationMetadata: 513,

    // NIP-33 replaceable events
    Project: 31933,
    Task: 1934,
    MCPTool: 4200,
    ProjectStatus: 24010,
} as const;

export type NDKKind = typeof NDKKind[keyof typeof NDKKind];
