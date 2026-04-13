import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const prismaMock = vi.hoisted(() => {
  const userCreate = vi.fn()
  const userBalanceCreate = vi.fn()

  return {
    userCreate,
    userBalanceCreate,
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: {
      user: { create: typeof userCreate }
      userBalance: { create: typeof userBalanceCreate }
    }) => Promise<unknown>) =>
      await callback({
        user: { create: userCreate },
        userBalance: { create: userBalanceCreate },
      })),
  }
})

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  AUTH_REGISTER_LIMIT: {
    windowSeconds: 60,
    maxRequests: 3,
  },
}))

const loggingMock = vi.hoisted(() => ({
  logAuthAction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/rate-limit', () => rateLimitMock)
vi.mock('@/lib/logging/semantic', () => loggingMock)

describe('api specific - auth register route', () => {
  const routeContext = { params: Promise.resolve({}) }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    rateLimitMock.checkRateLimit.mockResolvedValue({
      limited: false,
      remaining: 3,
      retryAfterSeconds: 0,
    })
    rateLimitMock.getClientIp.mockReturnValue('127.0.0.1')

    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.userCreate.mockResolvedValue({
      id: 'user-1',
      name: 'alice',
    })
    prismaMock.userBalanceCreate.mockResolvedValue({
      userId: 'user-1',
    })
  })

  it('returns conflict when username already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-existing',
      name: 'innoc',
    })

    const mod = await import('@/app/api/auth/register/route')
    const req = buildMockRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'accept-language': 'zh-CN',
      },
      body: {
        name: 'innoc',
        password: '123456',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.details.field).toBe('name')
    expect(body.error.details.reason).toBe('USERNAME_TAKEN')
    expect(body.message).toBe('该用户名已存在，请直接登录')
  })

  it('trims username before lookup and persistence', async () => {
    const mod = await import('@/app/api/auth/register/route')
    const req = buildMockRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'accept-language': 'en-US',
      },
      body: {
        name: '  alice  ',
        password: '123456',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.message).toBe('Registration successful')
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { name: 'alice' },
    })
    expect(prismaMock.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'alice',
        password: expect.any(String),
      }),
    })
  })

  it('rejects blank username after trimming', async () => {
    const mod = await import('@/app/api/auth/register/route')
    const req = buildMockRequest({
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'accept-language': 'en-US',
      },
      body: {
        name: '   ',
        password: '123456',
      },
    })

    const res = await mod.POST(req, routeContext)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_PARAMS')
    expect(body.error.details.field).toBe('name')
    expect(body.error.details.reason).toBe('MISSING_CREDENTIALS')
    expect(body.message).toBe('Username and password are required')
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })
})
