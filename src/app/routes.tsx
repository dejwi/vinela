import { createBrowserRouter } from 'react-router-dom'
import ColorSchemesPage from '@/features/colorschemes/pages/list'
import GraphEditorPage from '@/features/graph-editor/pages/editor'
import KeymapsPage from '@/features/keymaps/pages/keymaps'
import LspServersPage from '@/features/lsp/pages/lsp-servers'
import PluginsPage from '@/features/plugins/pages/list'
import NeovimOptionsPage from '@/features/settings/pages/neovim-options'
import SettingsPage from '@/features/settings/pages/settings'
import { HomeRoute } from './components/home-route'
import { RequireProject } from './components/require-project'
import { Layout } from './layout'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomeRoute />,
      },
      {
        element: <RequireProject />,
        children: [
          {
            path: 'editor',
            element: <GraphEditorPage />,
          },
          {
            path: 'plugins',
            element: <PluginsPage />,
          },
          {
            path: 'keymaps',
            element: <KeymapsPage />,
          },
          {
            path: 'lsp',
            element: <LspServersPage />,
          },
          {
            path: 'neovim-options',
            element: <NeovimOptionsPage />,
          },
          {
            path: 'colorschemes',
            element: <ColorSchemesPage />,
          },
        ],
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
])
