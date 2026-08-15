import { expect } from 'vitest'

export function expectRawLuaField(
  output: string,
  fieldName: string,
  expectedSnippet: string,
): void {
  expect(output).toContain(fieldName)
  expect(output).toContain(expectedSnippet)
  expect(output).not.toMatch(new RegExp(`\\b${fieldName}\\s*=\\s*"`))
}

export function expectFieldOmitted(output: string, fieldName: string): void {
  expect(output).not.toMatch(new RegExp(`\\b${fieldName}\\b`))
}
