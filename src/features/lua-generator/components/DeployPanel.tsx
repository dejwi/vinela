import { Archive, CheckCircle2, FileCode, XCircle } from 'lucide-react'
import { APP_DOWNLOAD_URL } from '@/shared/lib/app-identity'
import type { DeployResult } from '../types'

interface DeployPanelProps {
  deployResult: DeployResult
}

export function DeployPanel({
  deployResult,
}: DeployPanelProps): React.JSX.Element {
  if (deployResult.success) {
    return (
      <div className="space-y-3">
        {/* Success message */}
        <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Configuration deployed successfully
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileCode className="w-3.5 h-3.5 shrink-0" />
              <code className="bg-muted px-1.5 py-0.5 rounded break-all">
                {deployResult.outputPath}
              </code>
            </div>
          </div>
        </div>

        {/* Backup info */}
        {deployResult.backupCreated &&
          deployResult.backupPath !== undefined && (
            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
              <Archive className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Previous config backed up</p>
                <code className="text-xs text-muted-foreground break-all">
                  {deployResult.backupPath}
                </code>
              </div>
            </div>
          )}

        {/* Next steps hint */}
        <p className="text-xs text-muted-foreground">
          Open Neovim to see your new configuration in action. If something goes
          wrong, you can restore from the backup in Settings &gt; Neovim.
        </p>
      </div>
    )
  }

  // Failure state
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-destructive">Deploy failed</p>
        <p className="text-sm text-muted-foreground">{deployResult.error}</p>
        {deployResult.errorCode === 'permission-denied' && (
          <p className="text-xs text-muted-foreground mt-2">
            Check that you have write permissions to the Neovim config
            directory.
          </p>
        )}
        {deployResult.errorCode === 'directory-creation-failed' && (
          <p className="text-xs text-muted-foreground mt-2">
            Inspect the path named in the error for a regular file, symlink to a
            file, symlink target outside your home directory, or changed path
            authorization. Vinela can create a missing directory-link
            destination only when it safely resolves under home; it never
            removes or retargets that link. Correct the configured output path
            in Settings &gt; Output or repair the blocking entry manually.
          </p>
        )}
        {deployResult.errorCode === 'write-failed' &&
          deployResult.error.includes('output-file symlinks') && (
            <p className="text-xs text-muted-foreground mt-2">
              The configured output file is a symlink. Configure the real
              ordinary file path or repair the link manually — vinela will not
              follow or replace output-file symlinks.
            </p>
          )}
        {deployResult.errorCode === 'memory-mode' && (
          <p className="text-xs text-muted-foreground mt-2">
            Deploy is not available in browser mode.{' '}
            <a
              href={APP_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Download the desktop app
            </a>{' '}
            to write init.lua to your Neovim config directory.
          </p>
        )}
      </div>
    </div>
  )
}
