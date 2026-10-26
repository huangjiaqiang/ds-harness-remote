import { z } from 'zod'

import { decodeHostMention, encodeHostMention } from './remote-host-reference.js'
export { decodeHostMention, encodeHostMention } from './remote-host-reference.js'
export interface MentionHost { deviceId: string; name: string; platform: string; online: boolean }

/** Fixed read-only control surface; no remote mutation or generic tool dispatch. */
export async function handleHostMention(
  server: string, devices: (signal: AbortSignal) => Promise<MentionHost[]>,
  endpoint: 'hosts' | 'resolve', payload: unknown, signal: AbortSignal,
): Promise<unknown> {
  const input = endpoint === 'hosts' ? z.object({}).strict().parse(payload)
    : z.object({ ref: z.string().max(8192) }).strict().parse(payload)
  const target = 'ref' in input && typeof input.ref === 'string' ? decodeHostMention(input.ref) : undefined
  if (target && target.server !== server) throw new Error('REMOTE_HOST_SERVER_CHANGED')
  signal.throwIfAborted()
  const hosts = (await devices(signal)).filter(host => host.online)
  signal.throwIfAborted()
  if (!target) return hosts.map(host => ({
    hostId: host.deviceId, name: host.name, platform: host.platform,
    ref: encodeHostMention(server, host.deviceId),
  }))
  const host = hosts.find(host => host.deviceId === target.hostId)
  if (!host) throw new Error('REMOTE_HOST_UNAVAILABLE')
  return { hostId: host.deviceId, name: host.name, platform: host.platform }
}
