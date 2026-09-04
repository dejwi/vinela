import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { Switch } from '@/shared/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { isInitReady, type ProjectProfile } from '@/shared/types'
import { DEFAULT_PROFILE_COLOR, getActiveProfileIds } from '../profile-state'
import { useProjectProfilesStore } from '../store'

interface ProfileManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectPath: string
}

const PROFILE_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#64748b',
] as const

function valid(profiles: ProjectProfile[]): boolean {
  const ids = new Set<string>()
  const names = new Set<string>()
  return profiles.every((profile) => {
    const id = profile.id.trim()
    const name = profile.name.trim().toLowerCase()
    if (
      !id ||
      !name ||
      ids.has(id) ||
      names.has(name) ||
      !/^#[0-9a-fA-F]{6}$/.test(profile.color)
    )
      return false
    ids.add(id)
    names.add(name)
    return true
  })
}

export function ProfileManagerDialog({
  open,
  onOpenChange,
  projectPath,
}: ProfileManagerDialogProps): React.JSX.Element {
  const { profiles, overrides, initStatus, saveProfiles, setProfileActive } =
    useProjectProfilesStore()
  const [draft, setDraft] = useState<ProjectProfile[]>([])
  const [currentActiveIds, setCurrentActiveIds] = useState<Set<string>>(
    new Set(),
  )
  const [colorPickerProfileId, setColorPickerProfileId] = useState<
    string | null
  >(null)
  const seededProjectPath = useRef<string | null>(null)
  const ready = isInitReady(initStatus, projectPath)
  useEffect(() => {
    if (!open || !ready) {
      seededProjectPath.current = null
      setColorPickerProfileId(null)
      return
    }
    if (seededProjectPath.current === projectPath) return
    seededProjectPath.current = projectPath
    setDraft(profiles.map((profile) => ({ ...profile })))
    setCurrentActiveIds(new Set(getActiveProfileIds(profiles, overrides)))
  }, [open, overrides, profiles, projectPath, ready])
  const update = (index: number, updates: Partial<ProjectProfile>): void =>
    setDraft((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item,
      ),
    )
  async function save(): Promise<void> {
    if (!ready) return
    try {
      const normalized = draft.map((profile) => ({
        ...profile,
        name: profile.name.trim(),
        color: profile.color.toLowerCase(),
      }))
      await saveProfiles(normalized)
      for (const profile of normalized)
        await setProfileActive(profile.id, currentActiveIds.has(profile.id))
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save profiles',
      )
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/20 px-6 py-5 pr-12">
          <DialogTitle>Profiles</DialogTitle>
          <DialogDescription className="max-w-lg leading-relaxed">
            Group shortcuts into profiles. Attached shortcuts follow active
            profiles unless they have a local override. Active is local to this
            checkout (gitignored); Default is what a fresh clone starts with.
          </DialogDescription>
        </DialogHeader>
        <TooltipProvider>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-6 py-4">
            {draft.length === 0 && (
              <div className="rounded-lg border border-dashed px-5 py-8 text-center">
                <p className="text-sm font-medium">No profiles yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add one to group shortcuts that should be active together.
                </p>
              </div>
            )}
            {draft.map((profile, index) => {
              const name = profile.name.trim() || 'profile'
              const currentActive = currentActiveIds.has(profile.id)
              return (
                <div
                  className="flex items-center gap-1.5 rounded-lg border bg-card py-1.5 pr-1.5 pl-2"
                  key={profile.id}
                >
                  <Popover
                    open={colorPickerProfileId === profile.id}
                    onOpenChange={(pickerOpen) =>
                      setColorPickerProfileId(pickerOpen ? profile.id : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        aria-label={`Color for ${name}`}
                        className="h-7 w-7 shrink-0 p-1"
                        type="button"
                        variant="ghost"
                        size="icon"
                      >
                        <span
                          className="h-4 w-4 rounded-full ring-1 ring-black/10 ring-inset"
                          style={{ backgroundColor: profile.color }}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-56 p-3"
                      sideOffset={6}
                    >
                      <p className="text-xs font-medium">
                        Select profile color
                      </p>
                      <div className="mt-2 grid grid-cols-6 gap-1.5">
                        {PROFILE_COLORS.map((color) => (
                          <button
                            aria-label={`Set ${name} color to ${color}`}
                            className={`h-7 w-7 rounded-md border border-black/10 shadow-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              profile.color === color
                                ? 'ring-2 ring-ring ring-offset-2 ring-offset-background'
                                : ''
                            }`}
                            key={color}
                            onClick={() => {
                              update(index, { color })
                              setColorPickerProfileId(null)
                            }}
                            style={{ backgroundColor: color }}
                            title={color}
                            type="button"
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Input
                    aria-label={`Name for ${name}`}
                    className="h-8 min-w-0 flex-1 border-transparent bg-transparent px-1.5 shadow-none hover:border-input"
                    value={profile.name}
                    onChange={(event) =>
                      update(index, { name: event.target.value })
                    }
                    placeholder="Profile name"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          Active
                        </span>
                        <Switch
                          aria-label={`Use ${name} in current checkout`}
                          checked={currentActive}
                          onCheckedChange={(active) =>
                            setCurrentActiveIds((ids) => {
                              const next = new Set(ids)
                              if (active) next.add(profile.id)
                              else next.delete(profile.id)
                              return next
                            })
                          }
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      On or off in this checkout right now
                    </TooltipContent>
                  </Tooltip>
                  <div className="mx-0.5 h-5 w-px shrink-0 bg-border" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/** biome-ignore lint/a11y/noLabelWithoutControl: the Radix checkbox is the labelled control */}
                      <label className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Checkbox
                          aria-label={`Use ${name} by default in new checkouts`}
                          checked={profile.defaultActive}
                          className="size-3.5"
                          onCheckedChange={(checked) =>
                            update(index, { defaultActive: checked === true })
                          }
                        />
                        On after clone
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      Committed default — what a fresh git clone starts with
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    aria-label={`Remove ${name}`}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )
            })}
            <Button
              className="w-full border-dashed"
              variant="outline"
              onClick={() => {
                const profile: ProjectProfile = {
                  id: uuidv4(),
                  name: '',
                  color: DEFAULT_PROFILE_COLOR,
                  defaultActive: true,
                }
                setDraft((items) => [...items, profile])
                setCurrentActiveIds((ids) => new Set(ids).add(profile.id))
              }}
            >
              <Plus />
              Add profile
            </Button>
          </div>
        </TooltipProvider>
        <DialogFooter className="border-t bg-muted/10 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!ready || !valid(draft)}
            onClick={() => void save()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
