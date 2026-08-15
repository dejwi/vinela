import { Outlet } from 'react-router-dom'
import { useProjectStore } from '@/features/projects/store'
import { TutorialProvider } from '@/features/tutorial'
import { TutorialAutoStart } from '@/features/tutorial/hooks/useTutorialAutoStart'
import { Sidebar } from './components/sidebar'

export function Layout() {
  const currentProject = useProjectStore((state) => state.currentProject)

  return (
    <TutorialProvider>
      <div className="flex h-screen bg-background">
        {currentProject && <Sidebar />}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <TutorialAutoStart />
    </TutorialProvider>
  )
}
