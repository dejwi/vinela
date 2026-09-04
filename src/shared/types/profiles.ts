export interface ProjectProfile {
  id: string
  name: string
  color: string
  defaultActive: boolean
}

export interface ProjectProfilesFile {
  version: 1
  profiles: ProjectProfile[]
}

export interface ProjectProfilesLocalFile {
  version: 1
  overrides: Record<string, boolean>
}
