# DeepSeek Harness Remote

Continue DeepSeek Harness sessions and experimental Codex, Cursor, and Antigravity workspaces from another device over an end-to-end encrypted connection.

[GitHub](https://github.com/liguobao/ds-harness-remote) · [Full guide](https://github.com/liguobao/ds-harness-remote/blob/main/README.md) · [中文说明](https://github.com/liguobao/ds-harness-remote/blob/main/README.zh.md) · [Remote Web](https://dsh.r2049.cn/app) · [Android](https://github.com/liguobao/ds-harness-remote/releases/latest)

`ds-harness-remote` is the Remote Host and workspace plugin for DeepSeek Harness. Harness keeps running on your work computer with its existing workspaces, tools, and permission controls; Remote gives authorized devices another window into that environment.

> Install the npm package through Desktop Plugin management or `dsh plugin`. Both manage the selected Harness profile and its bundle configuration.

## Remote Agent tools

After signing in through the local Desktop/web-profile Remote panel, ask a native Harness Agent to list online Remote machines and the workspaces on a selected machine. The plugin registers `remote_list_hosts` (no arguments) and `remote_list_workspaces` (`hostId` from the first tool) when the official `tools` service is available.

Discovery reuses Remote account authorization, pinned Host identities and encrypted transport. Each workspace query owns a temporary connection and leaves the UI selection unchanged. Results identify the backend (`harness`, `codex`, or an available ACP backend); failed backend catalogs appear in `unavailable`. Host names, workspace paths and explicitly requested session history become part of the calling Agent's tool context and normal Harness tool history; credentials are not returned.

For native Harness workspaces (`backend: "harness"`), the same Agent can use:

| Tool | Purpose |
| --- | --- |
| `remote_list_sessions` | List root sessions in an existing workspace; live catalog pagination. |
| `remote_read_session` | Read bounded native history, with an older-page cursor and explicit truncation. |
| `remote_create_session` | Create an empty session in the selected workspace. |
| `remote_send_message` | Queue a text task or follow-up under existing Host permissions. |
| `remote_wait_sessions` | Observe up to eight sessions, for up to 60 seconds; zero requests snapshots. |
| `remote_interrupt_session` | Request interruption of the current execution; does not undo edits or delete queued messages. |
| `remote_get_operation` | Read an operation receipt without executing the operation again. |

Session tools require explicit `hostId`, `backend` and `workspaceId`; existing-session operations also require `sessionId`. Create/send/interrupt require a unique `operationId` (16–128 letters, digits, underscores or hyphens). The same key and parameters return the same in-memory receipt; changing parameters under that key is rejected. An `accepted` send receipt means queued, not completed. After an `unknown` result, inspect the receipt and remote session instead of retrying with a new key. Receipts are lost on Remote reset, leaving Remote, logout or restart; `not_found` is not proof that an earlier operation did not execute.

For example, ask: “On the Linux Host, create a Harness session in my project, run its tests, and report the result here.” The Agent discovers the target, creates and messages a session, then waits and reads its history. An `idle` status does not prove the task objective succeeded. Pending approval/question detection is limited to retained history; use the native UI to handle those requests. Waiting never approves or interrupts work automatically.

CodeX/ACP currently support workspace discovery only through these tools. This entry does not register an external MCP server. Terminal-only dsh-TUI profiles currently lack the local Remote Client runtime needed by these tools; they can still be discovered as target Hosts.

## Install

### DSH Desktop

In DeepSeek Harness Desktop, open **Extensions / Plugin management**, choose installation
from **npm**, and enter:

```text
ds-harness-remote@0.5.21
```

Restart Desktop after installation. Its official `dsh` launcher can also install the package:

```sh
dsh plugin --profile desktop add -w ds-harness-remote@0.5.21
```

Use Desktop's official launcher to manage its reserved `desktop` profile.

### Existing DSH installation

Add the current package version to the `web` profile, then restart Harness:

```sh
dsh plugin --profile web add -w ds-harness-remote@0.5.21
```

### dsh-TUI Host

Remote can also run as a Host in a terminal-only [dsh-TUI](https://github.com/ccch1mneyyy/dsh-TUI) profile:

```sh
dsh plugin --profile dsh-tui add -w ds-harness-remote@0.5.21
```

After starting dsh-TUI, manage Remote with `/remote`, `/remote login`, `/remote status`, and `/remote logout`.

## Highlights

- Continue active Harness sessions and review progress from another computer, the web, or Android.
- Send text and image prompts, answer questions, and handle permission requests.
- Open workspaces on another authorized computer without replacing the native Harness interface.
- Use the official workspace file tree and bounded read-only previews on supported Harness versions.
- Use an optional Host-local terminal and authorized loopback development-service previews.
- Open Host Codex projects in the existing Remote UI through the optional experimental Codex domain.
- Access Cursor and Antigravity workspaces through the optional experimental ACP gateway, with client-side projections kept in memory.
- Reach the Host without opening a public listening port or configuring router port forwarding.

## Compatibility

The development baseline is DeepSeek Harness `dsh-v0.2.1-rc.1`, retaining the official Typert Remote / Session V3 carrier from `0.2.0` RC. Earlier Typert carrier support remains capability-based.

`0.5.19` removes Harness `0.1.1-rc.2` ApiProxy support from the Host and bundled Remote client. ApiProxy-only Hosts and missing capability discovery are rejected. CodeX/ACP Desktop projection also uses Typert only.

The same package feature-detects the older settings registry and the `0.1.7-rc.1` and `0.2.0-rc.2` Volatile settings entry. Remote Web/Desktop and Android normalize released sessions that still report the retired `code` agent preset to `ptc`. The Host reads the running Harness version from the CLI entrypoint, or from the 0.2.0 Desktop shell's `@deepseek-ai/dsh-desktop-host` entrypoint when the Harness CLI package is only a sibling of that entrypoint inside `app.asar`.

## Self-hosted Server

This repository includes a minimal, single-account self-hosted Relay Server in [`apps/server`](https://github.com/liguobao/ds-harness-remote/tree/main/apps/server). Configure `DSH_SERVER_ACCOUNT` and `DSH_SERVER_PASSWORD`, then point the Host and clients at the same server URL. It provides account login, device credentials, encrypted Control/Noise forwarding, Relay, and a device-status page. It does not provide the complete multi-account Server, Remote Web session UI, or WebRTC/TURN deployment.

## Security boundary

- Session traffic is encrypted on the Client and decrypted only by the selected Host using `Noise_IK_25519_ChaChaPoly_SHA256`.
- Account membership and the Host's locally pinned device identity must both authorize a connection.
- The Host creates outbound connections only; it does not listen on a public port.
- Remote does not expose general tool RPC, remote desktop, or file-mutation APIs.
- Interactive terminals are enabled by default and can be disabled in the Host-local Remote settings; they run as the Host user independently of Agent approvals.

## Documentation

- [Complete guide](https://github.com/liguobao/ds-harness-remote#readme)
- [dsh-TUI Remote guide](https://github.com/liguobao/ds-harness-remote/blob/main/docs/dsh-tui.md)
- [Codex Remote technical notes](https://github.com/liguobao/ds-harness-remote/blob/main/docs/codex-remote.md)
- [Agent workspace integration guide](https://github.com/liguobao/ds-harness-remote/blob/main/docs/acp-integration.md)
- [End-to-end encryption](https://github.com/liguobao/ds-harness-remote/blob/main/docs/end-to-end-encryption.md)
- [Network and transport](https://github.com/liguobao/ds-harness-remote/blob/main/docs/network.md)
- [Protocol reference](https://github.com/liguobao/ds-harness-remote/blob/main/docs/protocol.md)
- [Changelog](https://github.com/liguobao/ds-harness-remote/blob/main/docs/CHANGELOG.md)

This is an independent community project and is not an official DeepSeek product. Licensed under the [MIT License](./LICENSE).

### Send directly to a Remote Host

Start a local Desktop/web-profile message with `@`, select an online Host, and type your message after the displayed `/remote HostName` prefix. Selecting the Host immediately starts its encrypted connection and prepares its durable default workspace. Sending awaits the same preparation before dispatch. On older installations without a durable default, it follows native Harness startup behavior and uses the most recently active workspace. The command prefix is removed from the remote message. The native input command intercepts submission before the local model: the plugin creates a remote session, sends only your original message, and opens that session in the existing Remote UI. Replies, approvals, interruption and follow-ups use the native remote session. No coordination instructions are added to user messages.

This entry accepts text only and requires the native `inputTriggers` service. Selecting a target does not send anything. Workspace resolution uses official Host APIs; no model guesses the directory. Delivery reuses operation receipts when retrying; unknown outcomes do not trigger a new send. Legacy 0.5.20 Host chips must be removed and selected again. Restored `/remote` command drafts without a selected target fail closed. Existing conversation history is not rewritten. Remote Tools remain separately available for explicit agent-coordination requests.
