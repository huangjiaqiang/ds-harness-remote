/** Browser-safe canonical identity codec. No names or instructions in the reference. */
const prefix = 'dsh-remote-host:'
function target(value: unknown): { server: string; hostId: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_REMOTE_HOST_REFERENCE')
  const row = value as Record<string, unknown>
  if (Object.keys(row).length !== 2 || typeof row.server !== 'string' || row.server.length < 1 || row.server.length > 2048
    || typeof row.hostId !== 'string' || row.hostId.length < 1 || row.hostId.length > 256) throw new Error('INVALID_REMOTE_HOST_REFERENCE')
  return { server: row.server, hostId: row.hostId }
}
export function encodeHostMention(server: string, hostId: string): string {
  return prefix + encodeURIComponent(JSON.stringify(target({ server, hostId })))
}
export function decodeHostMention(ref: string): { server: string; hostId: string } {
  if (ref.length > 8192 || !ref.startsWith(prefix)) throw new Error('INVALID_REMOTE_HOST_REFERENCE')
  const value = target(JSON.parse(decodeURIComponent(ref.slice(prefix.length))))
  if (encodeHostMention(value.server, value.hostId) !== ref) throw new Error('INVALID_REMOTE_HOST_REFERENCE')
  return value
}
