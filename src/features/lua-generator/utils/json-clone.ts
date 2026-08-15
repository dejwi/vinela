/**
 * JSON deep-clone for values that are known to be JSON-shaped.
 *
 * The lua-generator pipeline operates on values pre-validated to be free of
 * unsupported structures. Within that domain,
 * JSON.parse(JSON.stringify(v)) is a correct deep clone.
 */
export function jsonDeepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
