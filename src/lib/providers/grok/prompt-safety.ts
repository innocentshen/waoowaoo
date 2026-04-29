const GRAPHIC_REPLACEMENTS: Array<[RegExp, string]> = [
  [/血衣研究员/g, '受伤研究员'],
  [/白袍染血/g, '白袍带有暗红污渍'],
  [/满脸血污/g, '脸上带有受伤痕迹'],
  [/血污/g, '暗红污渍'],
  [/血浸透/g, '深色污渍浸透'],
  [/染血/g, '带有暗红污渍'],
  [/鲜血/g, '暗红色液滴'],
  [/血珠/g, '暗红色液滴'],
  [/血滴/g, '暗红色液滴'],
  [/血迹/g, '暗红色痕迹'],
  [/血渍/g, '暗红色痕迹'],
  [/血点/g, '暗红色细点'],
  [/血色/g, '红色'],
  [/血红/g, '暗红'],
  [/带血/g, '带有暗红痕迹'],
  [/伤口/g, '受伤痕迹'],
  [/渗血/g, '出现暗红痕迹'],
  [/流血/g, '出现暗红痕迹'],
  [/出血/g, '出现暗红痕迹'],
  [/喷溅/g, '散开'],
  [/溅开/g, '散开'],
  [/迸散/g, '散开'],
  [/炸开/g, '迅速散开'],
  [/砸上/g, '落在'],
  [/砸破/g, '打破'],
  [/死死/g, '紧紧'],
  [/拼死/g, '拼尽全力'],
  [/濒死/g, '极度紧张'],
  [/尸体/g, '倒下的人影'],
  [/内脏/g, '不可见的伤害细节'],
  [/gore/gi, 'non-graphic tension'],
  [/blood[-\s]?soaked/gi, 'dark-stained'],
  [/blood/gi, 'dark red mark'],
  [/bleeding/gi, 'showing injury marks'],
  [/open wound/gi, 'injury mark'],
]

const SENSITIVE_PATTERN = /(血|伤口|渗血|流血|出血|喷溅|溅开|迸散|炸开|尸体|内脏|blood|bleeding|gore|wound)/i
const MINOR_PATTERN = /(男孩|女孩|少年|少女|孩子|小孩|儿童|幼年|五六岁|未成年|child|children|boy|girl|minor|teen)/i

function applyGraphicReplacements(prompt: string): string {
  let safe = prompt
  for (const [pattern, replacement] of GRAPHIC_REPLACEMENTS) {
    safe = safe.replace(pattern, replacement)
  }
  return safe
}

export function normalizeGrokMediaPromptForSafety(prompt: string): string {
  const trimmed = typeof prompt === 'string' ? prompt.trim() : ''
  if (!trimmed) return ''

  const hasSensitiveContent = SENSITIVE_PATTERN.test(trimmed)
  const hasMinorContext = MINOR_PATTERN.test(trimmed)
  if (!hasSensitiveContent && !hasMinorContext) return trimmed

  const safePrompt = applyGraphicReplacements(trimmed)
  const constraints = [
    'Grok media safety constraints:',
    'non-graphic cinematic thriller style only',
    'no gore, no explicit injury detail, no open wounds, no body horror',
    'if any child or teenage character appears, show no visible injury to that character',
    'express danger through lighting, blocking, facial acting, camera movement, alarms, shadows, and atmosphere',
  ].join(' ')

  return `${safePrompt}\n\n${constraints}`
}
