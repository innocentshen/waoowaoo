#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import process from 'process'
import { pathToFileURL } from 'url'

const root = process.cwd()
const srcDir = path.join(root, 'src')
const PROJECT_READ_HELPER = 'src/lib/projects/project-read.ts'
const PROJECT_DIRECT_READ_PATTERN = /\.project\.(findUnique|findFirst)\s*\(/g
const PROJECT_RETURNING_PATTERN = /\.project\.(findMany|create|update|upsert)\s*\(/g
const PROJECT_RELATION_TRUE_PATTERN = /\bproject\s*:\s*true\b/g
const PROJECT_RELATION_OBJECT_PATTERN = /\bproject\s*:\s*\{/g
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])

function fail(title, details = []) {
  process.stderr.write(`\n[project-schema-drift-guard] ${title}\n`)
  for (const detail of details) {
    process.stderr.write(`  - ${detail}\n`)
  }
  process.exit(1)
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === '.next' || entry.name === 'node_modules') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(fullPath, out)
      continue
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(fullPath)
    }
  }
  return out
}

function toRel(fullPath, scanRoot = root) {
  return path.relative(scanRoot, fullPath).split(path.sep).join('/')
}

function getLineNumber(content, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (content[i] === '\n') line += 1
  }
  return line
}

function extractBalanced(content, startIndex, openChar, closeChar) {
  let depth = 0
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let i = startIndex; i < content.length; i += 1) {
    const char = content[i]
    const next = content[i + 1]
    const prev = content[i - 1]

    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }

    if (blockComment) {
      if (prev === '*' && char === '/') blockComment = false
      continue
    }

    if (quote) {
      if (char === quote && prev !== '\\') quote = null
      continue
    }

    if (char === '/' && next === '/') {
      lineComment = true
      i += 1
      continue
    }

    if (char === '/' && next === '*') {
      blockComment = true
      i += 1
      continue
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char
      continue
    }

    if (char === openChar) {
      depth += 1
      continue
    }

    if (char === closeChar) {
      depth -= 1
      if (depth === 0) {
        return content.slice(startIndex, i + 1)
      }
    }
  }

  return null
}

function inspectProjectSchemaDrift(relPath, content) {
  if (relPath === PROJECT_READ_HELPER) return []

  const violations = []

  for (const match of content.matchAll(PROJECT_DIRECT_READ_PATTERN)) {
    const index = match.index ?? 0
    const line = getLineNumber(content, index)
    violations.push(
      `${relPath}:${line} uses .project.${match[1]}(); route Project reads through findProjectBaseById/findProjectWithUserById`,
    )
  }

  for (const match of content.matchAll(PROJECT_RETURNING_PATTERN)) {
    const index = match.index ?? 0
    const line = getLineNumber(content, index)
    const openParenIndex = content.indexOf('(', index)
    const callText = openParenIndex >= 0 ? extractBalanced(content, openParenIndex, '(', ')') : null

    if (!callText || !/\bselect\s*:/.test(callText)) {
      violations.push(
        `${relPath}:${line} uses .project.${match[1]}() without an explicit select; default Project reads are drift-prone`,
      )
    }
  }

  for (const match of content.matchAll(PROJECT_RELATION_TRUE_PATTERN)) {
    const index = match.index ?? 0
    const line = getLineNumber(content, index)
    violations.push(
      `${relPath}:${line} loads project: true; replace with project: { select: { ... } } to avoid full Project reads`,
    )
  }

  for (const match of content.matchAll(PROJECT_RELATION_OBJECT_PATTERN)) {
    const index = match.index ?? 0
    const line = getLineNumber(content, index)
    const openBraceIndex = content.indexOf('{', index)
    const objectText = openBraceIndex >= 0 ? extractBalanced(content, openBraceIndex, '{', '}') : null
    if (!objectText) continue

    if (/\binclude\s*:/.test(objectText) && !/\bselect\s*:/.test(objectText)) {
      violations.push(
        `${relPath}:${line} loads project relation with include but no select; explicit project field selection is required`,
      )
    }
  }

  return violations
}

export function findProjectSchemaDriftViolations(scanRoot = root) {
  const files = walk(path.join(scanRoot, 'src'))
  return files
    .map((fullPath) => {
      const relPath = toRel(fullPath, scanRoot)
      const content = fs.readFileSync(fullPath, 'utf8')
      return inspectProjectSchemaDrift(relPath, content)
    })
    .flat()
}

export function main() {
  if (!fs.existsSync(srcDir)) {
    fail('Missing src directory')
  }

  const files = walk(srcDir)
  const violations = files
    .map((fullPath) => {
      const relPath = toRel(fullPath)
      const content = fs.readFileSync(fullPath, 'utf8')
      return inspectProjectSchemaDrift(relPath, content)
    })
    .flat()

  if (violations.length > 0) {
    fail('Found Project Prisma reads that can reintroduce schema-drift failures', violations)
  }

  process.stdout.write(`[project-schema-drift-guard] OK files=${files.length}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

export { inspectProjectSchemaDrift }
