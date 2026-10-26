import { describe, expect, it, vi } from 'vitest'
import { decodeHostMention, encodeHostMention, handleHostMention } from '../src/remote-host-mention.js'
import { createHostMentionSource } from '../src/client/host-mentions.js'

const server = 'https://example.com'
const host = { deviceId: 'host-1', name: 'Host', platform: 'linux', online: true }
const signal = () => new AbortController().signal

describe('Remote mention target authority', () => {
  it('binds the selected opaque Host identity and revalidates membership and server before sending', async () => {
    const devices = vi.fn(async () => [host, { ...host, deviceId: 'offline', online: false }])
    const rows = await handleHostMention(server, devices, 'hosts', {}, signal()) as Array<{ ref: string }>
    expect(rows).toHaveLength(1)
    expect(decodeHostMention(rows[0]!.ref)).toEqual({ server, hostId: host.deviceId })
    const text = await handleHostMention(server, devices, 'resolve', { ref: rows[0]!.ref }, signal())
    expect(text).toEqual({ hostId: 'host-1', name: 'Host', platform: 'linux' })
    const calls = devices.mock.calls.length
    await expect(handleHostMention('https://other.test', devices, 'resolve', { ref: rows[0]!.ref }, signal())).rejects.toThrow('SERVER_CHANGED')
    expect(devices).toHaveBeenCalledTimes(calls)
    devices.mockResolvedValue([])
    await expect(handleHostMention(server, devices, 'resolve', { ref: rows[0]!.ref }, signal())).rejects.toThrow('UNAVAILABLE')
    await expect(handleHostMention(server, devices, 'resolve', { ref: rows[0]!.ref, method: 'session/create' }, signal())).rejects.toThrow()
  })

  it('rejects malformed references and discards late candidates or serialized targets after cancellation', async () => {
    for (const ref of ['file:///tmp', 'dsh-remote-host:%', 'dsh-remote-host:%7B%7D']) expect(() => decodeHostMention(ref)).toThrow()
    const controller = new AbortController()
    const control = vi.fn(async () => { controller.abort(); return [] })
    const source = createHostMentionSource(control as never, () => false)
    await expect(source.candidates({ sessionId: 'local' }, { query: '', signal: controller.signal })).rejects.toThrow()
    const aborted = new AbortController()
    const serializer = createHostMentionSource((async () => { aborted.abort(); return 'late target' }) as never, () => false)
    await expect(serializer.codec.serialize(encodeHostMention(server, host.deviceId), aborted.signal)).rejects.toThrow()
  })
})

it('claims remote sends without a local prompt fallback, keeps raw text, and reuses delivery identity after navigation failure', async () => {
  const ref = encodeHostMention(server, host.deviceId)
  const calls: Array<{ endpoint: string; args: any }> = []
  let navigationFailed = false
  const control = async (endpoint: string, args?: unknown): Promise<any> => {
    calls.push({ endpoint, args })
    if (endpoint === 'mention.hosts') return [{ hostId: host.deviceId, name: host.name, platform: host.platform, ref }]
    if (endpoint === 'mention.default') return { workspaceId: 'workspace', title: 'Home', path: '/home' }
    if (endpoint === 'mention.dispatch') return { status: 'accepted', sessionId: 'remote-session' }
    if (!navigationFailed) { navigationFailed = true; throw new Error('disconnected') }
    return {}
  }
  const open = vi.fn()
  const source = createHostMentionSource(control, () => false, open)
  const session = { sessionId: 'local' }
  const hosts = await source.candidates(session, { query: '', signal: signal() })
  const picked = source.onPick({ candidate: hosts[0]!, session })!
  expect('claim' in picked).toBe(true)
  expect(calls.filter(row => row.endpoint === 'mention.default')).toHaveLength(1)
  if (!('claim' in picked) || !picked.claim) throw Error('missing claim')
  expect((await picked.claim.submit('original message', {}, [])).kind).toBe('error')
  expect((await picked.claim.submit('original message', {}, [])).kind).toBe('success')
  const sent = calls.filter(row => row.endpoint === 'mention.dispatch')
  expect(sent[0]!.args).toEqual(sent[1]!.args)
  expect(sent[0]!.args.message).toBe('original message')
  expect(open).toHaveBeenCalledOnce()
  expect((await picked.claim.submit('changed message', {}, [])).kind).toBe('error')
  await expect(source.matchEnter({ sessionId: 'restored' }, '/remote Host task', signal(), { attachments: 0 })).rejects.toThrow()
  await expect(source.codec.serialize(ref, signal())).rejects.toThrow('Legacy')
})
