import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getPrismaErrorCode } from '@/lib/prisma-error'

type ProjectBaseReadClient = Pick<typeof prisma, '$queryRaw' | 'project'>
type ProjectReadClient = ProjectBaseReadClient & Pick<typeof prisma, 'user'>

export const PROJECT_BASE_SELECT = {
  id: true,
  name: true,
  description: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  lastAccessedAt: true,
} satisfies Prisma.ProjectSelect

export const PROJECT_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
} satisfies Prisma.UserSelect

export type ProjectBaseRecord = Prisma.ProjectGetPayload<{
  select: typeof PROJECT_BASE_SELECT
}>

export type ProjectWithUserRecord = ProjectBaseRecord & {
  user: Prisma.UserGetPayload<{
    select: typeof PROJECT_USER_SELECT
  }> | null
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}

function isProjectSchemaDriftError(error: unknown): boolean {
  const prismaCode = getPrismaErrorCode(error)
  if (prismaCode !== 'P2022') return false

  const message = getErrorMessage(error).toLowerCase()
  return message.includes('projects.') && message.includes('does not exist')
}

async function queryProjectBaseFallback(
  db: Pick<ProjectBaseReadClient, '$queryRaw'>,
  projectId: string,
): Promise<ProjectBaseRecord | null> {
  const rows = await db.$queryRaw<ProjectBaseRecord[]>(Prisma.sql`
    SELECT
      id,
      name,
      description,
      userId,
      createdAt,
      updatedAt,
      lastAccessedAt
    FROM projects
    WHERE id = ${projectId}
    LIMIT 1
  `)
  return rows[0] ?? null
}

export async function findProjectBaseById(
  projectId: string,
  db: ProjectBaseReadClient = prisma,
): Promise<ProjectBaseRecord | null> {
  try {
    return await db.project.findUnique({
      where: { id: projectId },
      select: PROJECT_BASE_SELECT,
    })
  } catch (error) {
    if (!isProjectSchemaDriftError(error)) {
      throw error
    }
    return await queryProjectBaseFallback(db, projectId)
  }
}

export async function findProjectWithUserById(
  projectId: string,
  db: ProjectReadClient = prisma,
): Promise<ProjectWithUserRecord | null> {
  const project = await findProjectBaseById(projectId, db)
  if (!project) return null

  const user = await db.user.findUnique({
    where: { id: project.userId },
    select: PROJECT_USER_SELECT,
  })

  return {
    ...project,
    user,
  }
}
