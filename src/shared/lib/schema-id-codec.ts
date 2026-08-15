/**
 * Bijective codec for schema IDs ↔ filesystem-safe storage keys.
 *
 * Uses encodeURIComponent / decodeURIComponent which:
 * - Is bijective: different inputs always produce different outputs
 * - Is invertible: decode(encode(x)) === x for all x
 * - Preserves kebab-case IDs unchanged (a-z, 0-9, -, _, ., ~ are URI-safe)
 * - Encodes all filesystem-unsafe characters (: → %3A, / → %2F, etc.)
 *
 * Examples:
 *   "telescope-nvim"            → "telescope-nvim"          (unchanged)
 *   "github:folke/flash.nvim"   → "github%3Afolke%2Fflash.nvim"
 *   "a--b"                      → "a--b"                    (unchanged)
 *   "a:b"                       → "a%3Ab"                   (different from "a--b" ✓)
 *
 * Bijectivity proof:
 *   encodeURIComponent is injective (no two distinct inputs produce the same output)
 *   because the encoding is deterministic and reversible. The naive `--`/`__`
 *   replacement approach is NOT bijective: `a:b` → `a--b` and `a--b` → `a--b`
 *   collide. encodeURIComponent never produces this kind of collision.
 *
 * Migration: Existing kebab-case IDs encode to themselves, so no migration
 * is needed. encodeURIComponent('telescope-nvim') === 'telescope-nvim', so
 * existing files on disk are already correctly encoded.
 */
export function encodeSchemaId(id: string): string {
  return encodeURIComponent(id)
}

/**
 * Decode a filesystem storage key back to the original schema ID.
 * Inverse of encodeSchemaId: decodeSchemaId(encodeSchemaId(x)) === x for all x.
 */
export function decodeSchemaId(storageKey: string): string {
  return decodeURIComponent(storageKey)
}
