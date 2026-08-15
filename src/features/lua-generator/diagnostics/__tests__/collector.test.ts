import { beforeEach, describe, expect, it } from 'vitest'
import { DiagnosticsCollector } from '../collector'
import type { GenerationDiagnostic } from '../types'

describe('DiagnosticsCollector', () => {
  let collector: DiagnosticsCollector

  beforeEach(() => {
    collector = new DiagnosticsCollector()
  })

  describe('addError', () => {
    it('should add an error diagnostic with auto-assigned severity', () => {
      collector.addError({
        id: 'ERR_TEST_001',
        category: 'structure',
        message: 'Test error message',
      })

      expect(collector.hasErrors()).toBe(true)
      expect(collector.hasWarnings()).toBe(false)

      const errors = collector.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0]).toMatchObject({
        id: 'ERR_TEST_001',
        severity: 'error',
        category: 'structure',
        message: 'Test error message',
      })
    })

    it('should include source information when provided', () => {
      collector.addError({
        id: 'ERR_TEST_002',
        category: 'connectivity',
        message: 'Missing required port',
        source: {
          graphId: 'graph-1',
          nodeId: 'node-1',
          nodeType: 'action',
          portId: 'input-1',
        },
        suggestions: ['Connect a value'],
      })

      const errors = collector.getErrors()
      expect(errors[0]?.source).toEqual({
        graphId: 'graph-1',
        nodeId: 'node-1',
        nodeType: 'action',
        portId: 'input-1',
      })
      expect(errors[0]?.suggestions).toEqual(['Connect a value'])
    })
  })

  describe('addWarning', () => {
    it('should add a warning diagnostic with auto-assigned severity', () => {
      collector.addWarning({
        id: 'WARN_TEST_001',
        category: 'structure',
        message: 'Test warning message',
      })

      expect(collector.hasErrors()).toBe(false)
      expect(collector.hasWarnings()).toBe(true)

      const warnings = collector.getWarnings()
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toMatchObject({
        id: 'WARN_TEST_001',
        severity: 'warning',
        category: 'structure',
        message: 'Test warning message',
      })
    })
  })

  describe('deduplication', () => {
    it('should deduplicate by id only when no source', () => {
      collector.addError({
        id: 'ERR_DEDUPE_001',
        category: 'structure',
        message: 'First occurrence',
      })

      collector.addError({
        id: 'ERR_DEDUPE_001',
        category: 'structure',
        message: 'Second occurrence',
      })

      expect(collector.getErrors()).toHaveLength(1)
      expect(collector.getErrors()[0]?.message).toBe('First occurrence')
    })

    it('should deduplicate by id + source combination', () => {
      collector.addError({
        id: 'ERR_DEDUPE_002',
        category: 'connectivity',
        message: 'Missing port',
        source: { graphId: 'g1', nodeId: 'n1' },
      })

      // Same id but different source should be added
      collector.addError({
        id: 'ERR_DEDUPE_002',
        category: 'connectivity',
        message: 'Missing port',
        source: { graphId: 'g1', nodeId: 'n2' },
      })

      expect(collector.getErrors()).toHaveLength(2)
    })

    it('should deduplicate when id and source match', () => {
      collector.addError({
        id: 'ERR_DEDUPE_003',
        category: 'connectivity',
        message: 'First',
        source: { graphId: 'g1', nodeId: 'n1' },
      })

      collector.addError({
        id: 'ERR_DEDUPE_003',
        category: 'connectivity',
        message: 'Second',
        source: { graphId: 'g1', nodeId: 'n1' },
      })

      expect(collector.getErrors()).toHaveLength(1)
    })

    it('should deduplicate across severities (same id + source)', () => {
      collector.addError({
        id: 'TEST_001',
        category: 'structure',
        message: 'As error',
      })

      collector.addWarning({
        id: 'TEST_001',
        category: 'structure',
        message: 'As warning',
      })

      // Same id + source should dedupe, first one wins (error)
      expect(collector.getErrors()).toHaveLength(1)
      expect(collector.getWarnings()).toHaveLength(0)
      expect(collector.getAll()).toHaveLength(1)
    })
  })

  describe('getAll ordering', () => {
    it('should return errors before warnings', () => {
      collector.addWarning({
        id: 'WARN_001',
        category: 'structure',
        message: 'First warning',
      })

      collector.addError({
        id: 'ERR_001',
        category: 'structure',
        message: 'First error',
      })

      collector.addWarning({
        id: 'WARN_002',
        category: 'structure',
        message: 'Second warning',
      })

      const all = collector.getAll()
      expect(all).toHaveLength(3)
      expect(all[0]?.severity).toBe('error')
      expect(all[0]?.id).toBe('ERR_001')
      expect(all[1]?.severity).toBe('warning')
      expect(all[2]?.severity).toBe('warning')
    })
  })

  describe('merge', () => {
    it('should merge another collector into this one', () => {
      collector.addError({
        id: 'ERR_001',
        category: 'structure',
        message: 'Original error',
      })

      const other = new DiagnosticsCollector()
      other.addError({
        id: 'ERR_002',
        category: 'connectivity',
        message: 'Other error',
      })
      other.addWarning({
        id: 'WARN_001',
        category: 'config',
        message: 'Other warning',
      })

      collector.merge(other)

      expect(collector.getErrors()).toHaveLength(2)
      expect(collector.getWarnings()).toHaveLength(1)
    })

    it('should deduplicate during merge', () => {
      collector.addError({
        id: 'ERR_DUP',
        category: 'structure',
        message: 'Original',
      })

      const other = new DiagnosticsCollector()
      other.addError({
        id: 'ERR_DUP',
        category: 'structure',
        message: 'Duplicate',
      })

      collector.merge(other)

      expect(collector.getErrors()).toHaveLength(1)
    })
  })

  describe('count', () => {
    it('should return total count of diagnostics', () => {
      expect(collector.count).toBe(0)

      collector.addError({ id: 'E1', category: 'structure', message: 'Error' })
      expect(collector.count).toBe(1)

      collector.addWarning({ id: 'W1', category: 'structure', message: 'Warn' })
      expect(collector.count).toBe(2)
    })
  })

  describe('clear', () => {
    it('should remove all diagnostics', () => {
      collector.addError({ id: 'E1', category: 'structure', message: 'Error' })
      collector.addWarning({ id: 'W1', category: 'structure', message: 'Warn' })

      expect(collector.count).toBe(2)

      collector.clear()

      expect(collector.count).toBe(0)
      expect(collector.hasErrors()).toBe(false)
      expect(collector.hasWarnings()).toBe(false)
      expect(collector.getAll()).toHaveLength(0)
    })

    it('should allow adding diagnostics after clear', () => {
      collector.addError({ id: 'E1', category: 'structure', message: 'Error' })
      collector.clear()

      // Previously added diagnostic should not block re-adding
      collector.addError({ id: 'E1', category: 'structure', message: 'Error' })
      expect(collector.count).toBe(1)
    })
  })

  describe('immutability', () => {
    it('getErrors should return a copy', () => {
      collector.addError({ id: 'E1', category: 'structure', message: 'Error' })

      const errors1 = collector.getErrors()
      const errors2 = collector.getErrors()

      expect(errors1).not.toBe(errors2)
      expect(errors1).toEqual(errors2)
    })

    it('getWarnings should return a copy', () => {
      collector.addWarning({ id: 'W1', category: 'structure', message: 'Warn' })

      const warnings1 = collector.getWarnings()
      const warnings2 = collector.getWarnings()

      expect(warnings1).not.toBe(warnings2)
      expect(warnings1).toEqual(warnings2)
    })

    it('modifying returned arrays should not affect collector', () => {
      collector.addError({ id: 'E1', category: 'structure', message: 'Error' })

      const errors = collector.getErrors() as GenerationDiagnostic[]
      errors.pop()

      expect(collector.getErrors()).toHaveLength(1)
    })
  })
})
