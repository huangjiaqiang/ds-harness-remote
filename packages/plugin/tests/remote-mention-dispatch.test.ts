import { expect, it, vi } from 'vitest'
import { dispatchMention } from '../src/remote-mention-dispatch.js'
import { encodeHostMention } from '../src/remote-host-reference.js'

it('direct dispatch sends only user text through fixed native operations and stops on uncertain creation', async () => {
  const server = 'https://example.com'
  const args = { ref: encodeHostMention(server, 'host'), workspaceId: 'workspace', operationId: 'mention_1234567890', message: 'check storage' }
  const run = vi.fn().mockResolvedValueOnce({ status: 'unknown' })
  expect(await dispatchMention(server, args, run, new AbortController().signal)).toEqual({ status: 'unknown', stage: 'create' })
  expect(run).toHaveBeenCalledOnce()
  run.mockReset().mockResolvedValueOnce({ status: 'accepted', sessionId: 'session' }).mockResolvedValueOnce({ status: 'accepted' })
  expect(await dispatchMention(server, args, run, new AbortController().signal)).toMatchObject({ status: 'accepted', sessionId: 'session' })
  expect(run.mock.calls[1]!.slice(0, 2)).toEqual(['remote_send_message', { hostId: 'host', backend: 'harness', workspaceId: 'workspace', sessionId: 'session', operationId: 'mention_1234567890_send', message: 'check storage' }])
  const count = run.mock.calls.length
  await expect(dispatchMention('https://other.test', args, run, new AbortController().signal)).rejects.toThrow('SERVER_CHANGED')
  await expect(dispatchMention(server, { ...args, method: 'arbitrary' }, run, new AbortController().signal)).rejects.toThrow()
  expect(run).toHaveBeenCalledTimes(count)
})
