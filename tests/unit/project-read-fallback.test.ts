import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

describe('project-read fallback', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('falls back to raw SQL when project reads hit a missing legacy column', async () => {
    const createdAt = new Date('2026-04-07T00:00:00.000Z')
    const updatedAt = new Date('2026-04-07T01:00:00.000Z')
    const projectRow = {
      id: 'project-1',
      name: 'Project One',
      description: 'desc',
      userId: 'user-1',
      createdAt,
      updatedAt,
      lastAccessedAt: null,
    }

    prismaMock.project.findUnique.mockRejectedValue({
      code: 'P2022',
      message: 'The column `waoowaoo.projects.mode` does not exist in the current database.',
    })
    prismaMock.$queryRaw.mockResolvedValue([projectRow])

    const { findProjectBaseById } = await import('@/lib/projects/project-read')
    const result = await findProjectBaseById('project-1')

    expect(result).toEqual(projectRow)
    expect(prismaMock.project.findUnique).toHaveBeenCalledTimes(1)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('loads the related user after a fallback project lookup', async () => {
    const projectRow = {
      id: 'project-1',
      name: 'Project One',
      description: null,
      userId: 'user-1',
      createdAt: new Date('2026-04-07T00:00:00.000Z'),
      updatedAt: new Date('2026-04-07T01:00:00.000Z'),
      lastAccessedAt: null,
    }
    const userRow = {
      id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      emailVerified: null,
      image: null,
    }

    prismaMock.project.findUnique.mockRejectedValue({
      code: 'P2022',
      message: 'The column `waoowaoo.projects.mode` does not exist in the current database.',
    })
    prismaMock.$queryRaw.mockResolvedValue([projectRow])
    prismaMock.user.findUnique.mockResolvedValue(userRow)

    const { findProjectWithUserById } = await import('@/lib/projects/project-read')
    const result = await findProjectWithUserById('project-1')

    expect(result).toEqual({
      ...projectRow,
      user: userRow,
    })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        image: true,
      },
    })
  })

  it('does not swallow unrelated Prisma errors', async () => {
    const error = {
      code: 'P2002',
      message: 'Unique constraint failed',
    }
    prismaMock.project.findUnique.mockRejectedValue(error)

    const { findProjectBaseById } = await import('@/lib/projects/project-read')

    await expect(findProjectBaseById('project-1')).rejects.toBe(error)
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })
})
