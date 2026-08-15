// src/features/lua-generator/generators/nodes/action/index.ts
// Action node generators index

// Additional action generators (already present)
export {
  type CallFunctionActionConfig,
  callFunctionGenerator,
  type FunctionContext,
  generateCallFunction,
} from './call-function'
export {
  createAutocmdGenerator,
  generateCreateAutocmd,
} from './create-autocmd'
export {
  generateGetVariableAction,
  getVariableActionGenerator,
} from './get-variable'
// Domain 3-C2: Action Node Generators Group 1
export { generateRunAction } from './run-command'
export {
  generateSetHighlight,
  setHighlightGenerator,
} from './set-highlight'
export { generateSetKeymap } from './set-keymap'
export { generateSetOption } from './set-option'
export { generateSetVariable } from './set-variable'
