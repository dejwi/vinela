import { describe, expect, it } from 'vitest'
import type { ActionNodeData } from '@/shared/types'
import { inferPortTypeFromOptionType } from './ActionNode'

describe('ActionNode', () => {
  describe('inferPortTypeFromOptionType', () => {
    it('maps string-list to string', () => {
      expect(inferPortTypeFromOptionType('string-list')).toBe('string')
    })

    it('maps char-list to string', () => {
      expect(inferPortTypeFromOptionType('char-list')).toBe('string')
    })

    it('maps plain string to string', () => {
      expect(inferPortTypeFromOptionType('string')).toBe('string')
    })

    it('maps number to number', () => {
      expect(inferPortTypeFromOptionType('number')).toBe('number')
    })

    it('maps boolean to boolean', () => {
      expect(inferPortTypeFromOptionType('boolean')).toBe('boolean')
    })

    it('maps undefined to any', () => {
      expect(inferPortTypeFromOptionType(undefined)).toBe('any')
    })

    it('maps unknown type to any', () => {
      expect(inferPortTypeFromOptionType('unknown-type')).toBe('any')
    })
  })

  describe('set-option node data', () => {
    it('has correct shape for string-list option type', () => {
      const data: ActionNodeData = {
        nodeType: 'action',
        actionType: 'set-option',
        label: 'Set Option',
        actionConfig: {
          actionConfigType: 'set-option',
          optionName: 'wildignore',
          scope: 'global',
          valueConfig: {
            valueMode: 'suggested',
            suggestedValue: '*.o,*.obj',
          },
        },
      }

      // Verify the data structure
      expect(data.actionType).toBe('set-option')
      expect(data.actionConfig.actionConfigType).toBe('set-option')
      expect(data.actionConfig.optionName).toBe('wildignore')
      expect(inferPortTypeFromOptionType('string-list')).toBe('string')
    })

    it('has correct shape for char-list option type', () => {
      const data: ActionNodeData = {
        nodeType: 'action',
        actionType: 'set-option',
        label: 'Set Option',
        actionConfig: {
          actionConfigType: 'set-option',
          optionName: 'isfname',
          scope: 'global',
          valueConfig: {
            valueMode: 'suggested',
            suggestedValue: '@,48-57',
          },
        },
      }

      expect(data.actionType).toBe('set-option')
      expect(data.actionConfig.optionName).toBe('isfname')
      expect(inferPortTypeFromOptionType('char-list')).toBe('string')
    })
  })
})
