import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { logAuthAction } from '@/lib/logging/semantic'
import { apiHandler, ApiError } from '@/lib/api-errors'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIp, AUTH_REGISTER_LIMIT } from '@/lib/rate-limit'

function resolveAuthLocale(request: NextRequest): 'zh' | 'en' {
  const raw = request.headers.get('accept-language') || ''
  const first = raw.split(',')[0]?.trim().toLowerCase() || ''
  return first === 'en' || first.startsWith('en-') ? 'en' : 'zh'
}

function authMessage(
  locale: 'zh' | 'en',
  key: 'missingCredentials' | 'passwordTooShort' | 'usernameTaken' | 'signupSuccess',
): string {
  const messages = {
    zh: {
      missingCredentials: '请输入用户名和密码',
      passwordTooShort: '密码长度至少 6 位',
      usernameTaken: '该用户名已存在，请直接登录',
      signupSuccess: '注册成功',
    },
    en: {
      missingCredentials: 'Username and password are required',
      passwordTooShort: 'Password must be at least 6 characters',
      usernameTaken: 'This username already exists. Please sign in instead.',
      signupSuccess: 'Registration successful',
    },
  } as const

  return messages[locale][key]
}

export const POST = apiHandler(async (request: NextRequest) => {
  const locale = resolveAuthLocale(request)

  const ip = getClientIp(request)
  const rateResult = await checkRateLimit('auth:register', ip, AUTH_REGISTER_LIMIT)
  if (rateResult.limited) {
    logAuthAction('REGISTER', 'unknown', { error: 'Rate limited', ip })
    return NextResponse.json(
      {
        success: false,
        message:
          locale === 'en'
            ? `Too many requests. Please try again in ${rateResult.retryAfterSeconds} seconds`
            : `请求过于频繁，请 ${rateResult.retryAfterSeconds} 秒后再试`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateResult.retryAfterSeconds) },
      },
    )
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!name || !password) {
    logAuthAction('REGISTER', name || 'unknown', { error: 'Missing credentials' })
    throw new ApiError('INVALID_PARAMS', {
      message: authMessage(locale, 'missingCredentials'),
      field: !name ? 'name' : 'password',
      reason: 'MISSING_CREDENTIALS',
    })
  }

  if (password.length < 6) {
    logAuthAction('REGISTER', name, { error: 'Password too short' })
    throw new ApiError('INVALID_PARAMS', {
      message: authMessage(locale, 'passwordTooShort'),
      field: 'password',
      reason: 'PASSWORD_TOO_SHORT',
    })
  }

  const existingUser = await prisma.user.findUnique({
    where: { name },
  })

  if (existingUser) {
    logAuthAction('REGISTER', name, { error: 'Username already exists' })
    throw new ApiError('CONFLICT', {
      message: authMessage(locale, 'usernameTaken'),
      field: 'name',
      reason: 'USERNAME_TAKEN',
    })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          password: hashedPassword,
        },
      })

      await tx.userBalance.create({
        data: {
          userId: newUser.id,
          balance: 0,
          frozenAmount: 0,
          totalSpent: 0,
        },
      })

      return newUser
    })

    logAuthAction('REGISTER', name, { userId: user.id, success: true })

    return NextResponse.json(
      {
        message: authMessage(locale, 'signupSuccess'),
        user: {
          id: user.id,
          name: user.name,
        },
      },
      { status: 201 },
    )
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'P2002') {
      logAuthAction('REGISTER', name, { error: 'Username already exists' })
      throw new ApiError('CONFLICT', {
        message: authMessage(locale, 'usernameTaken'),
        field: 'name',
        reason: 'USERNAME_TAKEN',
      })
    }
    throw error
  }
})
