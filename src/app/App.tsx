import { RouterProvider } from 'react-router-dom'
import { MemoryModeIndicator } from './components/MemoryModeIndicator'
import { Providers } from './providers'
import { router } from './routes'

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <MemoryModeIndicator />
    </Providers>
  )
}
