import { describe, expect, it } from 'vitest'
import type { StoreInitStatus } from '../init-lifecycle'
import { isInitComplete, isInitReady } from '../init-lifecycle'

describe('StoreInitStatus type guards', () => {
  describe('isInitComplete', () => {
    it('returns false for idle', () => {
      const status: StoreInitStatus = { status: 'idle' }
      expect(isInitComplete(status, '/any')).toBe(false)
    })

    it('returns false for loading with matching path', () => {
      const status: StoreInitStatus = { status: 'loading', projectPath: '/a' }
      expect(isInitComplete(status, '/a')).toBe(false)
    })

    it('returns false for loading with different path', () => {
      const status: StoreInitStatus = { status: 'loading', projectPath: '/a' }
      expect(isInitComplete(status, '/b')).toBe(false)
    })

    it('returns true for ready with matching path', () => {
      const status: StoreInitStatus = { status: 'ready', projectPath: '/a' }
      expect(isInitComplete(status, '/a')).toBe(true)
    })

    it('returns false for ready with different path', () => {
      const status: StoreInitStatus = { status: 'ready', projectPath: '/a' }
      expect(isInitComplete(status, '/b')).toBe(false)
    })

    it('returns true for error with matching path', () => {
      const status: StoreInitStatus = {
        status: 'error',
        projectPath: '/a',
        error: 'fail',
      }
      expect(isInitComplete(status, '/a')).toBe(true)
    })

    it('returns false for error with different path', () => {
      const status: StoreInitStatus = {
        status: 'error',
        projectPath: '/a',
        error: 'fail',
      }
      expect(isInitComplete(status, '/b')).toBe(false)
    })
  })

  describe('isInitReady', () => {
    it('returns true only for ready with matching path', () => {
      expect(isInitReady({ status: 'ready', projectPath: '/a' }, '/a')).toBe(
        true,
      )
    })

    it('returns false for ready with different path', () => {
      expect(isInitReady({ status: 'ready', projectPath: '/a' }, '/b')).toBe(
        false,
      )
    })

    it('returns false for error with matching path', () => {
      expect(
        isInitReady({ status: 'error', projectPath: '/a', error: 'x' }, '/a'),
      ).toBe(false)
    })

    it('returns false for idle', () => {
      expect(isInitReady({ status: 'idle' }, '/a')).toBe(false)
    })

    it('returns false for loading with matching path', () => {
      expect(isInitReady({ status: 'loading', projectPath: '/a' }, '/a')).toBe(
        false,
      )
    })
  })
})
