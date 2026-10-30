import { createHmac } from 'node:crypto'

export interface IceConfig {
  stunUrls: string[]
  turnUrls: string[]
  turnSecret?: string
  turnUsername?: string
  turnPassword?: string
  turnTtlSeconds: number
}

export interface IceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export interface IceEnvironment {
  DSH_SERVER_STUN_URLS?: string
  DSH_SERVER_TURN_URLS?: string
  DSH_SERVER_TURN_SECRET?: string
  DSH_SERVER_TURN_USERNAME?: string
  DSH_SERVER_TURN_PASSWORD?: string
  DSH_SERVER_TURN_TTL?: string
}

const DEFAULT_TURN_TTL_SECONDS = 3600
const MIN_TURN_TTL_SECONDS = 60
const MAX_TURN_TTL_SECONDS = 24 * 3600

export function defaultIceConfig(): IceConfig {
  return { stunUrls: [], turnUrls: [], turnTtlSeconds: DEFAULT_TURN_TTL_SECONDS }
}

export function parseIceConfig(env: IceEnvironment = process.env): IceConfig {
  const stunUrls = parseUrls(env.DSH_SERVER_STUN_URLS, ['stun:', 'stuns:'], 'DSH_SERVER_STUN_URLS')
  const turnUrls = parseUrls(env.DSH_SERVER_TURN_URLS, ['turn:', 'turns:'], 'DSH_SERVER_TURN_URLS')
  const turnSecret = optional(env.DSH_SERVER_TURN_SECRET)
  const turnUsername = optional(env.DSH_SERVER_TURN_USERNAME)
  const turnPassword = optional(env.DSH_SERVER_TURN_PASSWORD)
  const turnTtlSeconds = parseTtl(env.DSH_SERVER_TURN_TTL)

  if (turnSecret !== undefined && (turnUsername !== undefined || turnPassword !== undefined)) {
    throw new Error('Set either DSH_SERVER_TURN_SECRET or DSH_SERVER_TURN_USERNAME + DSH_SERVER_TURN_PASSWORD, not both.')
  }
  if (turnUrls.length > 0 && turnSecret === undefined && (turnUsername === undefined || turnPassword === undefined)) {
    throw new Error('DSH_SERVER_TURN_URLS requires DSH_SERVER_TURN_SECRET or DSH_SERVER_TURN_USERNAME + DSH_SERVER_TURN_PASSWORD.')
  }
  if (turnUrls.length === 0 && turnSecret !== undefined) {
    throw new Error('DSH_SERVER_TURN_SECRET requires DSH_SERVER_TURN_URLS.')
  }
  if (turnUrls.length === 0 && (turnUsername !== undefined || turnPassword !== undefined)) {
    throw new Error('DSH_SERVER_TURN_USERNAME/DSH_SERVER_TURN_PASSWORD require DSH_SERVER_TURN_URLS.')
  }

  return {
    stunUrls,
    turnUrls,
    ...(turnSecret === undefined ? {} : { turnSecret }),
    ...(turnUsername === undefined ? {} : { turnUsername }),
    ...(turnPassword === undefined ? {} : { turnPassword }),
    turnTtlSeconds,
  }
}

/**
 * Short-lived TURN credentials use the coturn `use-auth-secret` convention:
 * `username` is `<unix-expiry>:<device-id>` and `credential` is the base64
 * HMAC-SHA1 of that username. Static credentials are supported for deployments
 * that cannot use a shared secret.
 */
export function iceServersFor(config: IceConfig, deviceId: string, now = Date.now()): IceServer[] {
  const servers: IceServer[] = []
  if (config.stunUrls.length > 0) servers.push({ urls: config.stunUrls })
  if (config.turnUrls.length === 0) return servers
  if (config.turnSecret !== undefined) {
    const username = `${Math.floor(now / 1000) + config.turnTtlSeconds}:${deviceId}`
    servers.push({
      urls: config.turnUrls,
      username,
      credential: createHmac('sha1', config.turnSecret).update(username).digest('base64'),
    })
  } else if (config.turnUsername !== undefined && config.turnPassword !== undefined) {
    servers.push({ urls: config.turnUrls, username: config.turnUsername, credential: config.turnPassword })
  }
  return servers
}

function parseUrls(value: string | undefined, schemes: string[], name: string): string[] {
  if (value === undefined) return []
  const urls = value.split(',').map(url => url.trim()).filter(url => url.length > 0)
  for (const url of urls) {
    if (!schemes.some(scheme => url.toLowerCase().startsWith(scheme))) {
      throw new Error(`${name} contains an unsupported URL: ${url}`)
    }
  }
  return [...new Set(urls)]
}

function parseTtl(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_TURN_TTL_SECONDS
  const ttl = Number(value)
  if (!Number.isInteger(ttl) || ttl < MIN_TURN_TTL_SECONDS || ttl > MAX_TURN_TTL_SECONDS) {
    throw new Error(`DSH_SERVER_TURN_TTL must be an integer between ${MIN_TURN_TTL_SECONDS} and ${MAX_TURN_TTL_SECONDS}.`)
  }
  return ttl
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed === undefined || trimmed === '' ? undefined : trimmed
}
