import { useEffect, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import type { Graph } from '@/shared/types'

interface RenameGraphDialogProps {
  open: boolean
  graph: Graph | null
  onOpenChange: (open: boolean) => void
  onRename: (name: string) => Promise<void>
}

export function RenameGraphDialog({
  open,
  graph,
  onOpenChange,
  onRename,
}: RenameGraphDialogProps) {
  const [name, setName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    if (!open || !graph) {
      setName('')
      return
    }

    setName(graph.name)
  }, [graph, open])

  const trimmedName = name.trim()

  const handleRename = async (): Promise<void> => {
    if (!trimmedName) {
      return
    }

    setIsRenaming(true)
    try {
      await onRename(trimmedName)
      onOpenChange(false)
    } finally {
      setIsRenaming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Graph</DialogTitle>
          <DialogDescription>
            Choose a new name for this graph.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder="Graph name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && trimmedName) {
                void handleRename()
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleRename()}
            disabled={!trimmedName || isRenaming}
          >
            {isRenaming ? 'Renaming...' : 'Rename'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
