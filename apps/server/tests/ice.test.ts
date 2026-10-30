import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { defaultIceConfig, iceServersFor, parseIceConfig } from '../src/ice.js'

describe('ICE configuration', () => {
  it('parses comma-separated STUN and TURN URLs', () => {
    const config = parseIceConfig({
      DSH_SERVER_STUN_URLS: 'stun:stun.example.com:3478, stuns:stun.example.com:5349',
      DSH_SERVER_TURN_URLS: 'turn:turn.example.com:3478?transport=udp, turns:turn.example.com:5349?transport=tcp',
      DSH_SERVER_TURN_SECRET: 'shared-secret',
      DSH_SERVER_TURN_TTL: '600',
    })
    expect(config.stunUrls).toEqual(['stun:stun.example.com:3478', 'stuns:stun.example.com:5349'])
    expect(config.turnUrls).toEqual([
      'turn:turn.example.com:3478?transport=udp',
      'turns:turn.example.com:5349?transport=tcp',
    ])
    expect(config.turnSecret).toBe('shared-secret')
    expect(config.turnTtlSeconds).toBe(600)
  })

  it('generates coturn-compatible short-lived TURN credentials', () => {
    const now = 1_700_000_000_000
    const username = `${Math.floor(now / 1000) + 600}:device-1`
    expect(iceServersFor({
      stunUrls: ['stun:stun.example.com:3478'],
      turnUrls: ['turn:turn.example.com:3478'],
      turnSecret: 'shared-secret',
      turnTtlSeconds: 600,
    }, 'device-1', now)).toEqual([
      { urls: ['stun:stun.example.com:3478'] },
      {
        urls: ['turn:turn.example.com:3478'],
        username,
        credential: createHmac('sha1', 'shared-secret').update(username).digest('base64'),
      },
    ])
  })

  it('supports static TURN credentials', () => {
    expect(iceServersFor({
      stunUrls: [],
      turnUrls: ['turn:turn.example.com:3478'],
      turnUsername: 'static-user',
      turnPassword: 'static-password',
      turnTtlSeconds: 3600,
    }, 'device-1')).toEqual([
      { urls: ['turn:turn.example.com:3478'], username: 'static-user', credential: 'static-password' },
    ])
  })

  it('returns no ICE servers when nothing is configured', () => {
    expect(defaultIceConfig()).toEqual({ stunUrls: [], turnUrls: [], turnTtlSeconds: 3600 })
    expect(iceServersFor(defaultIceConfig(), 'device-1')).toEqual([])
  })

  it('rejects unsupported URL schemes and incomplete TURN authentication', () => {
    expect(() => parseIceConfig({ DSH_SERVER_STUN_URLS: 'https://stun.example.com' })).toThrow(/unsupported URL/)
    expect(() => parseIceConfig({ DSH_SERVER_TURN_URLS: 'turn:turn.example.com:3478' })).toThrow(/requires/)
    expect(() => parseIceConfig({
      DSH_SERVER_TURN_USERNAME: 'static-user',
      DSH_SERVER_TURN_PASSWORD: 'static-password',
    })).toThrow(/require DSH_SERVER_TURN_URLS/)
    expect(() => parseIceConfig({
      DSH_SERVER_TURN_URLS: 'turn:turn.example.com:3478',
      DSH_SERVER_TURN_SECRET: 'shared-secret',
      DSH_SERVER_TURN_USERNAME: 'both',
    })).toThrow(/not both/)
    expect(() => parseIceConfig({ DSH_SERVER_TURN_TTL: '0' })).toThrow(/between/)
  })
})
