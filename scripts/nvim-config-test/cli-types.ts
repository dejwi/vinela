import type {
  GenerationDiagnostic,
  GenerationMetadata,
} from '@/features/lua-generator/types'

export type ProjectWriteMode = 'deny' | 'allow-copy' | 'allow-source'

export interface ProjectWriteEvent {
  operation: 'ensure-dir' | 'write-json' | 'write-text' | 'remove'
  relativePath: string
  targetKind: 'project-copy' | 'source-project'
  allowed: boolean
  reason: 'optional-dir' | 'migration' | 'explicit-write' | 'unknown'
}

export type GenerationCliFailureKind =
  | 'invalid-project'
  | 'generation-diagnostics'
  | 'project-write-denied'
  | 'project-copy-failed'
  | 'unexpected-error'

export type GenerationCliReport =
  | {
      success: true
      sourceProjectPath: string
      effectiveProjectPath: string
      projectCopyPath?: string
      projectWriteMode: ProjectWriteMode
      projectWriteEvents: readonly ProjectWriteEvent[]
      initLuaPath: string
      reportPath: string
      diagnostics: readonly GenerationDiagnostic[]
      metadata: GenerationMetadata
      warningsCount: number
      errorsCount: 0
    }
  | {
      success: false
      sourceProjectPath: string
      effectiveProjectPath?: string
      projectCopyPath?: string
      projectWriteMode: ProjectWriteMode
      projectWriteEvents: readonly ProjectWriteEvent[]
      initLuaPath?: string
      reportPath: string
      diagnostics: readonly GenerationDiagnostic[]
      metadata: GenerationMetadata
      warningsCount: number
      errorsCount: number
      failureKind: GenerationCliFailureKind
      errorSummary: string
    }

export type NvimMode = 'syntax' | 'source' | 'startup'

export type NvimCachePolicy =
  | 'none'
  | 'isolated-fresh-cleared'
  | 'isolated-implicit-cold'
  | 'isolated-reused'

export type NvimCachePolicyReason =
  | 'mode-has-no-plugin-runtime'
  | 'fresh-flag-cleared-stage-roots'
  | 'new-run-dir-no-prior-cache-detected'
  | 'reuse-cache-flag'
  | 'stable-work-dir-existing-cache'

export type NvimPackAddConfirmPolicy =
  | 'not-applicable'
  | 'test-prelude-confirm-false'
  | 'generated-confirm-false'
  | 'interactive-default'

export interface NvimValidationPolicySummary {
  mode: NvimMode
  cachePolicy: NvimCachePolicy
  cachePolicyReason: NvimCachePolicyReason
  pluginBootstrapExpected: boolean
  nonInteractiveInstall: boolean
  packAddConfirmPolicy: NvimPackAddConfirmPolicy
  postStartupWaitMs: number
  timeoutMs: number
  stageWorkDir: string
  xdgDataHome?: string
  xdgConfigHome?: string
  xdgStateHome?: string
  xdgCacheHome?: string
  packRoot?: string
  dataRootExistedBeforeRun: boolean
  dataRootClearedBeforeRun: boolean
}

export interface NvimVersionInfo {
  raw: string
  version: string
  major: number
  minor: number
  patch: number
}

export type NvimVersionCheckResult =
  | {
      status: 'available'
      info: NvimVersionInfo
    }
  | {
      status: 'missing'
      command: string
      errorSummary: string
    }
  | {
      status: 'unsupported'
      command: string
      info: NvimVersionInfo
      minimumVersion: string
      errorSummary: string
    }

export type NvimFailureKind =
  | 'missing-init'
  | 'missing-nvim'
  | 'unsupported-nvim-version'
  | 'timeout'
  | 'process-exit'
  | 'syntax-error'
  | 'startup-error'
  | 'plugin-network-error'
  | 'module-not-found'
  | 'report-error'

export interface NvimFinalizerReport {
  version: string
  vErrmsg: string
  messages: string
  runtimepath: string
  packpath: string
  data: string
  config: string
  state: string
  cache: string
  packRoot: string
  packPlugins: readonly string[]
  finalizerError?: string
}

export interface NvimIsolatedEnvSummary {
  xdgConfigHome?: string
  xdgDataHome?: string
  xdgStateHome?: string
  xdgCacheHome?: string
  xdgRuntimeDir?: string
  nvimAppname?: string
  initPathEnv: string
  reportPathEnv?: string
  finalizerPathEnv?: string
}

export type NvimTestReport =
  | {
      success: true
      mode: NvimMode
      initLuaPath: string
      nvimVersion: string
      command: readonly string[]
      env: NvimIsolatedEnvSummary
      durationMs: number
      stdoutPath: string
      stderrPath: string
      verboseLogPath?: string
      startuptimeLogPath?: string
      nvimReportPath?: string
      latestReportDir?: string
      validationPolicy: NvimValidationPolicySummary
      warnings: readonly string[]
    }
  | {
      success: false
      mode: NvimMode
      initLuaPath: string
      command: readonly string[]
      env: NvimIsolatedEnvSummary
      durationMs: number
      stdoutPath: string
      stderrPath: string
      verboseLogPath?: string
      startuptimeLogPath?: string
      nvimReportPath?: string
      latestReportDir?: string
      failureKind: NvimFailureKind
      errorSummary: string
      errorExcerpt: string
      nvimVersion?: string
      validationPolicy: NvimValidationPolicySummary
    }

export interface ClassifyNvimOutputInput {
  mode: NvimMode
  exitCode: number | null
  timedOut: boolean
  stdout: string
  stderr: string
  nvimReport: NvimFinalizerReport | null
  versionCheck: NvimVersionCheckResult
}

export type NvimOutputClassification =
  | { success: true; warnings: readonly string[] }
  | {
      success: false
      failureKind: NvimFailureKind
      errorSummary: string
      errorExcerpt: string
    }

export type WorkflowStageName = 'generation' | 'syntax' | 'source' | 'startup'

export type WorkflowStageStatus = 'passed' | 'failed' | 'skipped' | 'not-run'

export interface WorkflowStageSummary {
  stage: WorkflowStageName
  status: WorkflowStageStatus
  reportPath?: string
  durationMs?: number
  failureKind?: string
  errorSummary?: string
  validationPolicy?: NvimValidationPolicySummary
}

export interface CombinedWorkflowValidationSummary {
  requestedMode: NvimMode
  requestedFresh: boolean
  requestedReuseCache: boolean
  startupPolicy?: NvimValidationPolicySummary
}

export type CombinedWorkflowReport =
  | {
      success: true
      pipeline: readonly WorkflowStageName[]
      stages: readonly WorkflowStageSummary[]
      firstFailureStage: null
      initLuaPath: string
      combinedReportPath: string
      validationSummary: CombinedWorkflowValidationSummary
      latestReportDir?: string
    }
  | {
      success: false
      pipeline: readonly WorkflowStageName[]
      stages: readonly WorkflowStageSummary[]
      firstFailureStage: WorkflowStageName
      firstFailureReportPath: string
      errorSummary: string
      combinedReportPath: string
      validationSummary: CombinedWorkflowValidationSummary
      latestReportDir?: string
    }

export interface GenerateCommandArgs {
  projectPath: string
  outDir: string
  initLuaPath: string
  reportPath: string
  appDataRoot: string
  useProjectCopy: boolean
  allowProjectWrites: boolean
  failOnWarning: boolean
  json: boolean
  quiet: boolean
}

export interface NvimTestCommandArgs {
  initLuaPath: string
  mode: NvimMode
  workDir: string
  cacheDir: string
  runId: string
  keepRuns: number
  latest: boolean
  reuseCache: boolean
  fresh: boolean
  timeoutMs: number
  postStartupWaitMs: number
  nvimCommand: string
  minNvimVersion?: string
  json: boolean
  verboseLog: boolean
  startupTime: boolean
}

export interface WorkflowCommandArgs {
  projectPath: string
  mode: NvimMode
  pipeline: readonly WorkflowStageName[]
  workDir: string
  cacheDir: string
  runId: string
  keepRuns: number
  latest: boolean
  reuseCache: boolean
  fresh: boolean
  timeoutMs: number
  postStartupWaitMs: number
  nvimCommand: string
  minNvimVersion?: string
  appDataRoot: string
  allowProjectWrites: boolean
  useProjectCopy: boolean
  failOnWarning: boolean
  json: boolean
  quiet: boolean
}

export type ParseArgsResult<T> =
  | { success: true; value: T }
  | { success: false; exitCode: 2; message: string }
