import { z } from 'zod'
import type { RemoteTypertGateway } from './remote-typert-gateway.js'

const workspace = z.object({ workspaceId: z.string().min(1), title: z.string(), path: z.string(), sessionIds: z.array(z.string()), createdAt: z.union([z.string(), z.number()]).optional() })
/** Same startup policy as native Harness: durable default, then most recently used workspace. */
export async function defaultRemoteWorkspace(gateway: RemoteTypertGateway, signal: AbortSignal) {
  const initialized = await gateway.invoke({ namespace: 'workspace', method: 'initializeDefault', args: {}, signal })
  if (initialized !== undefined && initialized !== null) {
    const result = z.object({ workspace }).parse(initialized).workspace
    return { workspaceId: result.workspaceId, title: result.title, path: result.path }
  }
  const lifetime = new AbortController()
  const stream = await gateway.open('workspace/follow', { args: {} }, AbortSignal.any([signal, lifetime.signal]))
  const iterator = stream[Symbol.asyncIterator]()
  let rows: z.infer<typeof workspace>[]
  try {
    const frame = await iterator.next()
    rows = z.object({ type: z.literal('baseline'), value: z.object({ items: z.array(workspace) }) }).parse(frame.value).value.items
  } finally { lifetime.abort(); await iterator.return?.() }
  const sessions = z.object({ items: z.array(z.object({ sessionId: z.string(), updatedAt: z.number() })) }).parse(
    await gateway.invoke({ namespace: 'session', method: 'list', args: { _request: {} }, signal }),
  ).items
  const times = new Map(sessions.map(row => [row.sessionId, row.updatedAt]))
  let selected: z.infer<typeof workspace> | undefined, selectedTime = Number.NEGATIVE_INFINITY
  for (const row of rows) {
    let latest = Math.max(Number.NEGATIVE_INFINITY, ...row.sessionIds.flatMap(id => times.has(id) ? [times.get(id)!] : []))
    if (latest === Number.NEGATIVE_INFINITY && row.createdAt !== undefined) latest = typeof row.createdAt === 'number' ? row.createdAt : Date.parse(row.createdAt)
    if (!selected || latest > selectedTime) { selected = row; selectedTime = latest }
  }
  if (!selected) throw new Error('REMOTE_DEFAULT_WORKSPACE_UNAVAILABLE')
  return { workspaceId: selected.workspaceId, title: selected.title, path: selected.path }
}
