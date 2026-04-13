import { describe, expect, it } from 'vitest'
import { inspectProjectSchemaDrift } from '../../../scripts/guards/project-schema-drift-guard.mjs'

describe('project schema drift guard', () => {
  it('allows the compatibility helper to own direct Project reads', () => {
    expect(
      inspectProjectSchemaDrift(
        'src/lib/projects/project-read.ts',
        'return db.project.findUnique({ where: { id }, select: PROJECT_BASE_SELECT })',
      ),
    ).toEqual([])
  })

  it('flags direct Project findUnique and findFirst reads', () => {
    expect(
      inspectProjectSchemaDrift(
        'src/lib/example.ts',
        'await prisma.project.findUnique({ where: { id } }); await tx.project.findFirst({ where: { id } })',
      ),
    ).toEqual([
      'src/lib/example.ts:1 uses .project.findUnique(); route Project reads through findProjectBaseById/findProjectWithUserById',
      'src/lib/example.ts:1 uses .project.findFirst(); route Project reads through findProjectBaseById/findProjectWithUserById',
    ])
  })

  it('requires explicit select for Project rows returned from Prisma', () => {
    expect(
      inspectProjectSchemaDrift(
        'src/app/api/projects/route.ts',
        `
          await prisma.project.findMany({ where: { userId } })
          await prisma.project.create({ data: { userId, name: 'demo' } })
          await prisma.project.update({
            where: { id },
            data: { name: 'updated' },
            select: { id: true, name: true },
          })
        `,
      ),
    ).toEqual([
      'src/app/api/projects/route.ts:2 uses .project.findMany() without an explicit select; default Project reads are drift-prone',
      'src/app/api/projects/route.ts:3 uses .project.create() without an explicit select; default Project reads are drift-prone',
    ])
  })

  it('flags Project relation loads that hydrate the whole Project model', () => {
    expect(
      inspectProjectSchemaDrift(
        'src/lib/example.ts',
        `
          await prisma.novelPromotionProject.findUnique({
            include: { project: true }
          })
          await prisma.task.findMany({
            include: {
              project: {
                include: { user: true }
              }
            }
          })
        `,
      ),
    ).toEqual([
      'src/lib/example.ts:3 loads project: true; replace with project: { select: { ... } } to avoid full Project reads',
      'src/lib/example.ts:7 loads project relation with include but no select; explicit project field selection is required',
    ])
  })

  it('ignores Project filters and explicit relation selects', () => {
    expect(
      inspectProjectSchemaDrift(
        'src/lib/example.ts',
        `
          await prisma.novelCharacter.findMany({
            where: { novelPromotionProject: { project: { userId } } },
            include: {
              novelPromotionProject: {
                include: {
                  project: {
                    select: { id: true, name: true }
                  }
                }
              }
            }
          })
        `,
      ),
    ).toEqual([])
  })
})
