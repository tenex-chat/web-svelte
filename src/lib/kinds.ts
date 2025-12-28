/**
 * Centralized event kind definitions for TENEX.
 *
 * This module extends NDK's NDKKind enum with custom Tenex event kinds.
 * All kind references throughout the codebase should use this module instead
 * of importing NDKKind directly or using magic numbers.
 */

import { NDKKind as BaseNDKKind } from "@nostr-dev-kit/ndk";

// Custom kind values not in base NDK
export const CustomKinds = {
    // Standard NIP kinds not in NDK
    AgentRequest: 3199 as const,
    AgentRequestList: 13199 as const,
    AgentLesson: 4129 as const,
    AgentDefinition: 4199 as const,
    AgentNudge: 4201 as const,
    AgentDefinitionPack: 34199 as const,
    MCPTool: 4200 as const,

    // Tenex custom kinds (2xxxx range)
    TenexProjectStatus: 24010 as const,
    ProjectStatus: 24010 as const, // Alias for TenexProjectStatus
    TenexAgentConfigUpdate: 24020 as const,
    TenexAgentTypingStart: 24111 as const,
    TenexAgentTypingStop: 24112 as const,
    TenexOperationsStatus: 24133 as const,
    TenexStopCommand: 24134 as const,
    TenexProjectStart: 24000 as const,
    TenexLLMConfigChange: 24101 as const,
    TenexConversationMetadata: 513 as const,
};

// Re-export all base NDK kinds merged with our custom kinds
export const NDKKind = {
    ...BaseNDKKind,
    ...CustomKinds
};

// The type should accept any number since event kinds are just numbers
// This maintains compatibility with NDK's NDKFilter<K extends number> generic
export type NDKKind = number;
