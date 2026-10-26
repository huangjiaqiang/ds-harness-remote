import { decodeHostMention } from '../remote-host-reference.js'
interface DirectWorkspace { workspaceId: string; title: string; path: string }
interface HostCandidate { hostId: string; name: string; platform: string; ref: string }
interface Candidate { name: string; label?: string; description?: string; value?: string; section?: string }
interface Session { sessionId: string }
/** Selecting a Host immediately claims submission; never leave an unclaimed @ intermediate draft. */
export function createHostMentionSource(
  control: <T>(endpoint: string, payload?: unknown) => Promise<T>, chinese: () => boolean,
  openRemote: () => void = () => {},
) {
  const claims = new Map<string, ReturnType<typeof claim>>()
  const copy = (zh: string, en: string) => chinese() ? zh : en
  function claim(host: HostCandidate) {
    const operationId = `mention_${crypto.randomUUID()}`
    let submitted: string | undefined
    // Selection starts preparation immediately. Convert rejection into a value
    // until submit consumes it, so an abandoned draft has no unhandled promise.
    const prepared = control<DirectWorkspace>('mention.default', { ref: host.ref })
      .then(workspace => ({ workspace }), () => ({ workspace: undefined }))
    const label = host.name.replace(/\s+/g, ' ').trim()
    return {
      name: 'remote', token: `/remote ${label} `, attachments: false,
      hint: copy(`直接发送到 ${label}；使用默认工作区`, `Send directly to ${label}; use the default workspace`),
      async submit(message: string, _context: unknown, attachments: readonly unknown[]) {
        if (attachments.length) return { kind: 'error' as const, text: copy('远程派发暂仅支持文字。', 'Remote dispatch currently accepts text only.') }
        if (!message.trim()) return { kind: 'error' as const, text: copy('请输入要发给远端的消息。', 'Enter a message for the remote Agent.') }
        if (submitted !== undefined && submitted !== message) return { kind: 'error' as const,
          text: copy('此投递已开始，请先检查远端会话，再重新选择目标。', 'This delivery has started. Inspect the remote session before selecting a new target.') }
        try {
          const { workspace } = await prepared
          if (!workspace) return { kind: 'error' as const, text: copy('连接或默认工作区准备失败，请重新选择主机。', 'Connection or default workspace preparation failed. Select the Host again.') }
          submitted = message
          const target = { ref: host.ref, workspaceId: workspace.workspaceId }
          const receipt = await control<{ status: string; sessionId?: string }>('mention.dispatch', { ...target, operationId, message })
          if (receipt.status !== 'accepted' || !receipt.sessionId) return { kind: 'error' as const,
            text: copy('远端投递未确认，请检查 Remote 会话，勿重复创建任务。', 'Remote delivery is unconfirmed. Inspect Remote sessions; do not create the task again.') }
          await control('mention.open', { ...target, sessionId: receipt.sessionId })
          openRemote()
          return { kind: 'success' as const }
        } catch {
          return { kind: 'error' as const, text: copy('未能完成远程投递或打开会话。重试将复用同一操作回执；请勿重新创建任务。', 'Remote delivery or navigation failed. Retrying reuses the operation receipt; do not create the task again.') }
        }
      },
    }
  }
  return {
    trigger: '@' as const, name: 'remote-host', order: -10, showGroupTitle: false,
    async candidates(_session: Session, request: { query: string; position?: string; quoted?: boolean; signal: AbortSignal }): Promise<Candidate[]> {
      if (request.position === 'inline' || request.quoted || request.signal.aborted) return []
      const hosts = await control<HostCandidate[]>('mention.hosts')
      request.signal.throwIfAborted()
      const query = request.query.toLocaleLowerCase()
      return hosts.filter(host => `${host.name} ${host.hostId}`.toLocaleLowerCase().includes(query)).slice(0, 30).map(host => ({
        name: host.name, label: host.name, description: host.platform,
        section: copy('发送到远程主机', 'Send to Remote Host'), value: JSON.stringify(host),
      }))
    },
    onPick({ candidate, session, position }: { candidate: Candidate; session: Session; position?: string }) {
      if (!candidate.value || position === 'inline') return undefined
      const host: HostCandidate = JSON.parse(candidate.value)
      decodeHostMention(host.ref)
      const command = claim(host)
      claims.set(session.sessionId, command)
      return { claim: command }
    },
    // Harness 0.2.1 only adjudicates slash-prefixed plain drafts. Use its native
    // command form so restored drafts cannot silently fall through to a local model.
    async matchEnter(session: Session, line: string, _signal: AbortSignal, envelope: { attachments: number }) {
      if (!/^\/remote(?:\s|$)/.test(line)) return undefined
      const command = claims.get(session.sessionId)
      if (!command || !(line.startsWith(command.token) || line === command.token.trimEnd())) throw new Error(copy('请从 @ 菜单重新选择远程主机。', 'Select the Remote Host again from @.'))
      if (envelope.attachments) throw new Error(copy('远程派发暂仅支持文字。', 'Remote dispatch currently accepts text only.'))
      return { claim: command }
    },
    codec: {
      clipboardText(ref: string) { decodeHostMention(ref); return ref },
      async serialize(_ref: string, _signal: AbortSignal): Promise<string> {
        throw new Error(copy('旧主机引用已停用，请删除后从 @ 菜单重新选择。', 'Legacy Host reference retired. Remove it and select the target again from @.'))
      },
    },
  }
}
