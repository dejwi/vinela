import { lazy, Suspense } from 'react'
import { Navigate } from 'react-router-dom'
import { useProjectStore } from '@/features/projects/store'

const StartScreen = lazy(() => import('@/features/start/pages/start-screen'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  )
}

/**
 * Home route guard.
 * - If a project is loaded: redirect to /plugins
 * - If no project: render start screen
 */
export function HomeRoute() {
  const currentProject = useProjectStore((state) => state.currentProject)

  if (currentProject) {
    return <Navigate to="/plugins" replace />
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <StartScreen />
    </Suspense>
  )
}
