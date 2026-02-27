# OpenClaw Release v2026.2.26

Welcome to the latest release of OpenClaw! This update brings significant improvements to secrets management, agent runtimes, and CLI capabilities.

## External Secrets Management

We've introduced a full OpenClaw secrets workflow.
- **Audit, Configure, Apply, Reload**: Complete lifecycle management.
- **Runtime Snapshot Activation**: seamless updates.
- **Strict Validation**: apply target-path validation.
- **Safer Migration Scrubbing**: enhanced security.

## ACP/Thread-bound Agents

ACP agents are now first-class runtimes for thread sessions.
- **Spawn/Send Dispatch**: improved integration.
- **Lifecycle Controls**: better management of agent lifecycles.
- **Coalesced Thread Replies**: cleaner communication.

## Agents/Routing CLI

New CLI commands for account-scoped route management:
- `openclaw agents bind`
- `openclaw agents unbind`
- **Role-aware Binding**: identity handling.
- **Plugin-resolved Binding**: flexible account IDs.

## Codex/WebSocket Transport

OpenAI-Codex is now **WebSocket-first** by default.
- Transport: "auto" with SSE fallback.
- Explicit per-model/runtime overrides available.
- Improved regression coverage.

## Onboarding & Plugins

Channel plugins now own interactive onboarding flows.
- `configureInteractive` hooks.
- `configureWhenConfigured` hooks.
- Preserves generic fallback path.

## Auth & Security

Added explicit account-risk warning for Gemini CLI OAuth.
- Confirmation gate before starting.
- Documented caution in provider docs.

## Android Nodes

Enhanced Android device capabilities:
- `device.status` and `device.info` commands.
- `notifications.list` support.
- Exposed in agent tooling.

## Fixes & Improvements

- **Telegram/DM**: Enforced allowlist runtime inheritance.
- **Delivery Queue**: Prevented retry starvation with backoff.
- **Gemini OAuth**: Aligned project discovery metadata.
- **Google Chat**: Fixed startup/shutdown loops.
- **Linux**: Fixed temp dir permissions (umask 0002).
- **Microsoft Teams**: Improved file upload reliability.
