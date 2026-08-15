import { stripLuaLongBracketLiterals } from '@/features/lua-generator/lua-utils'

function analyzeBlockStructure(code: string): {
  doCount: number
  endCount: number
  ifCount: number
  thenCount: number
  forCount: number
  whileCount: number
  repeatCount: number
  untilCount: number
  functionCount: number
  returnCount: number
} {
  let cleaned = stripLuaLongBracketLiterals(code).replace(/--[^\n]*/g, '')
  cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, '""')
  cleaned = cleaned.replace(/'(?:[^'\\]|\\.)*'/g, "''")

  const countKeyword = (keyword: string): number => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g')
    return (cleaned.match(regex) || []).length
  }

  return {
    doCount: countKeyword('do'),
    endCount: countKeyword('end'),
    ifCount: countKeyword('if'),
    thenCount: countKeyword('then'),
    forCount: countKeyword('for'),
    whileCount: countKeyword('while'),
    repeatCount: countKeyword('repeat'),
    untilCount: countKeyword('until'),
    functionCount: countKeyword('function'),
    returnCount: countKeyword('return'),
  }
}

export function checkMismatchedKeywords(
  code: string,
): Array<{ keyword: string; message: string }> {
  const warnings: Array<{ keyword: string; message: string }> = []
  const analysis = analyzeBlockStructure(code)

  const blockOpeners =
    analysis.doCount +
    analysis.ifCount +
    analysis.forCount +
    analysis.whileCount +
    analysis.functionCount
  if (blockOpeners !== analysis.endCount) {
    warnings.push({
      keyword: 'do/end',
      message: `Mismatched block keywords: ${blockOpeners} block opener(s) (do/if/for/while/function), ${analysis.endCount} end`,
    })
  }

  if (analysis.ifCount !== analysis.thenCount) {
    warnings.push({
      keyword: 'if/then',
      message: `Mismatched if/then: ${analysis.ifCount} if, ${analysis.thenCount} then`,
    })
  }

  if (analysis.repeatCount !== analysis.untilCount) {
    warnings.push({
      keyword: 'repeat/until',
      message: `Mismatched repeat/until: ${analysis.repeatCount} repeat, ${analysis.untilCount} until`,
    })
  }

  return warnings
}
