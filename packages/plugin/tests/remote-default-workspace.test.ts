import { expect, it, vi } from 'vitest'
import { defaultRemoteWorkspace } from '../src/remote-default-workspace.js'
import type { RemoteTypertGateway } from '../src/remote-typert-gateway.js'
it('uses the official durable default and native recent-workspace fallback, without guessing a filesystem path', async () => {
  const first = { workspaceId: 'first', title: 'First', path: '/first', sessionIds: ['s1'], createdAt: '2026-01-01' }
  const recent = { ...first, workspaceId: 'recent', sessionIds: ['s2'] }
  const gateway = {
    invoke: vi.fn().mockResolvedValueOnce({ workspace: first }),
    open: vi.fn(async () => (async function* () { yield { type: 'baseline', value: { items: [first, recent] } } })()),
  }
  const resolve = () => defaultRemoteWorkspace(gateway as unknown as RemoteTypertGateway, new AbortController().signal)
  expect((await resolve()).workspaceId).toBe('first')
  expect(gateway.open).not.toHaveBeenCalled()
  gateway.invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ items: [{ sessionId: 's1', updatedAt: 1 }, { sessionId: 's2', updatedAt: 2 }] })
  expect((await resolve()).workspaceId).toBe('recent')
  gateway.invoke.mockRejectedValueOnce(new Error('permission denied'))
  await expect(resolve()).rejects.toThrow('permission denied')
})
