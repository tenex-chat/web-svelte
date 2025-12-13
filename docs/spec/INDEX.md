# TENEX Technical Product Specification

## Overview

TENEX is a decentralized platform for coordinating AI agents, built on the Nostr protocol. Unlike traditional SaaS applications, TENEX operates without a central server. All data—projects, conversations, agent definitions, and task status—is stored as events on Nostr relays.

This specification provides a comprehensive guide for rebuilding the TENEX application from scratch in any language or framework. It details the event schemas, data models, user interface flows, and architectural patterns required to replicate the full functionality of the system.

## Core Concepts

*   **Decentralization:** No backend API. The client communicates directly with Nostr relays.
*   **Agent Orchestration:** Users define "Projects" and invite AI "Agents" to collaborate within them.
*   **Agent vs. Agent Definition:**
    *   **Agent Definition (Class):** A blueprint event (Kind 4199) defining an agent's persona, capabilities, and instructions. Created by a user.
    *   **Agent (Instance):** An active participant with its own keypair (Pubkey). It is "instantiated" or "invited" into a project based on a definition.
*   **Threading:** A robust conversation model using standard NIP-10 tags (`e`) for replies and custom context tags (`E`) for grouping.

## Documentation Index

This specification is divided into the following detailed documents:

1.  [**Event Specifications (EVENTS.md)**](./EVENTS.md)
    *   Detailed schema for all standard and custom Nostr event kinds.
    *   Tagging conventions (including the critical `e` vs `E` distinction).
    *   Agent Definition vs. Agent Instance structure.

2.  [**UX & Navigation Flow (UX_FLOW.md)**](./UX_FLOW.md)
    *   Screen hierarchy and navigation logic.
    *   Project columns, tabs, and conversation views.
    *   User interactions for creating projects and chatting with agents.

3.  [**System Architecture (ARCHITECTURE.md)**](./ARCHITECTURE.md)
    *   Client-side architecture and state management.
    *   Data flow and relay subscription patterns.
    *   Logic for handling real-time agent streaming and status updates.

4.  [**Tooling & Protocols (TOOLS.md)**](./TOOLS.md)
    *   MCP Tool definitions (Kind 4200) and execution flow.
    *   Client-side rendering of tool outputs (Bash, File IO).
    *   Agent Nudge (Kind 4201) protocol for steering behavior.

## Intention

The intention of this report is to capture **ABSOLUTELY everything** required to rebuild the app. If a developer follows these specs, they should be able to recreate the exact data structure and user experience of TENEX without access to the original source code.
