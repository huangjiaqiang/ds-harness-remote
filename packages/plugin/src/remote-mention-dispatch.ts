import { z } from 'zod'
import { decodeHostMention } from './remote-host-reference.js'
import type { SessionToolOperation } from './remote-session-tools.js'

const target = z.object({ ref: z.string().max(8192), workspaceId: z.string().min(1).max(256) }).strict()
export const mentionTarget = target
const dispatchInput = target.extend({ operationId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/), message: z.string().min(1).max(64 * 1024).refine(s => s.trim().length > 0) })
type Run = (operation: SessionToolOperation, input: unknown, signal: AbortSignal) => Promise<unknown>
interface Receipt { status: string; sessionId?: string }
/** Fixed create + prompt composition; underlying operation ledger owns dedupe and uncertain writes. */
export async function dispatchMention(server: string, input: unknown, run: Run, signal: AbortSignal) {
  const args = dispatchInput.parse(input)
  const host = decodeHostMention(args.ref)
  if (host.server !== server) throw new Error('REMOTE_HOST_SERVER_CHANGED')
  const workspace = { hostId: host.hostId, backend: 'harness' as const, workspaceId: args.workspaceId }
  const created = await run('remote_create_session', { ...workspace, operationId: `${args.operationId}_create` }, signal) as Receipt
  if (created.status !== 'accepted' || !created.sessionId) return { status: created.status, stage: 'create' }
  const session = { ...workspace, sessionId: created.sessionId }
  const sent = await run('remote_send_message', { ...session, operationId: `${args.operationId}_send`, message: args.message }, signal) as Receipt
  return { ...session, status: sent.status, stage: 'send' }
}
