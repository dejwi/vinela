import type { TutorialStepDefinition } from '@/shared/types/tutorial'

/**
 * Short-form tutorial step definitions (~10 steps).
 * Flow: welcome → plugins → keymaps → options → colorschemes → graph editor → settings → conclusion
 * All steps use click-next for consistent progression.
 */
export const TUTORIAL_STEPS: readonly TutorialStepDefinition[] = [
  // ─── STEP 1: WELCOME ──────────────────────────────────────
  {
    id: 'welcome',
    section: 'welcome',
    title: 'Welcome to vinela!',
    content:
      "Let's take a quick tour of the app. You'll learn how to configure " +
      'Neovim with plugins, keymaps, and options — no Lua knowledge required.',
    hint: 'You can replay this tutorial anytime from Settings.',
    target: null,
    tooltipPlacement: 'center',
    advanceCondition: { type: 'click-next' },
    requiredRoute: null,
    allowBack: false,
  },

  // ─── STEP 2: PLUGINS OVERVIEW ─────────────────────────────
  {
    id: 'plugins-overview',
    section: 'plugins',
    title: 'Plugins',
    content:
      'Plugins extend Neovim with powerful features like fuzzy finding, ' +
      'syntax highlighting, and git integration.\n\n' +
      'The **Browse** tab shows available plugins. The **Installed** tab ' +
      'shows what you have installed.',
    hint: 'Try installing Telescope — a popular fuzzy finder.',
    target: 'plugins-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/plugins',
    setupActionId: 'prepare-plugins-browse',
  },

  // ─── STEP 3: PLUGIN INSTALL HINT ──────────────────────────
  {
    id: 'plugin-install-hint',
    section: 'plugins',
    title: 'Installing Plugins',
    content:
      'Click any plugin card to view its details, then click **Install Plugin** ' +
      'to add it to your configuration.\n\n' +
      'Installed plugins are automatically included when you generate your Lua file.',
    hint: 'Each plugin page shows available configuration options.',
    target: 'plugins-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/plugins',
  },

  // ─── STEP 4: KEYMAPS OVERVIEW ─────────────────────────────
  {
    id: 'keymaps-overview',
    section: 'keymaps',
    title: 'Keyboard Shortcuts',
    content:
      'The **Keymaps** page shows all keyboard shortcuts for your configuration. ' +
      'You can create shortcuts that run commands, call functions, or invoke ' +
      'custom actions you build.',
    hint: 'Click **New Shortcut** to create your first keymap.',
    target: 'keymaps-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/keymaps',
    setupActionId: 'prepare-keymaps-page',
  },

  // ─── STEP 5: KEYMAPS CREATE HINT ──────────────────────────
  {
    id: 'keymaps-create-hint',
    section: 'keymaps',
    title: 'Creating Shortcuts',
    content:
      'When creating a shortcut, you can:\n\n' +
      '• **Capture** any key combination\n' +
      '• Choose the **mode** (normal, insert, visual, etc.)\n' +
      '• Select what **action** to run',
    hint: 'Custom actions can be built in the Graph Editor.',
    target: 'keymaps-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/keymaps',
  },

  // ─── STEP 6: OPTIONS OVERVIEW ─────────────────────────────
  {
    id: 'options-overview',
    section: 'neovim-options',
    title: 'Neovim Options',
    content:
      'The **Neovim Options** page is a catalog of all built-in Neovim settings ' +
      'organized by category.\n\n' +
      'Use the **Popular** tab for essential options, or **All** for the complete list.',
    hint: 'Try searching for "cursorline" or "number".',
    target: 'neovim-options-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/neovim-options',
    setupActionId: 'reset-neovim-options-tutorial-state',
  },

  // ─── STEP 7: COLOR SCHEMES OVERVIEW ───────────────────────
  {
    id: 'colorschemes-overview',
    section: 'colorschemes',
    title: 'Color Schemes',
    content:
      'The **Color Schemes** page lets you browse and install themes for your editor. ' +
      'Each card shows a live preview.\n\n' +
      'Install multiple themes and set one as active.',
    hint: 'Installed themes are included in your generated Lua configuration.',
    target: 'colorschemes-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/colorschemes',
  },

  // ─── STEP 8: GRAPH EDITOR BRIEF ───────────────────────────
  {
    id: 'graph-editor-brief',
    section: 'graph-editor',
    title: 'Graph Editor (Advanced)',
    content:
      'The **Graph Editor** is where you build custom multi-step actions visually. ' +
      'Each box is a **node** representing an action, and lines show the execution flow.\n\n' +
      'Use it for complex configurations that combine multiple operations.',
    hint: 'Most users start with plugins and keymaps — return here when ready.',
    target: 'graph-canvas',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/editor',
    setupActionId: 'ensure-graph-sidebar-expanded',
  },

  // ─── STEP 9: SETTINGS OVERVIEW ──────────────────────────────
  {
    id: 'settings-overview',
    section: 'settings',
    title: 'App Settings',
    content:
      'The **Settings** page lets you customize vinela itself. ' +
      'Choose your theme, configure the graph editor, and set your output path ' +
      'for generated Lua files.\n\n' +
      'You can also **replay this tutorial** anytime from the Help section.',
    hint: 'Check the Neovim section to verify your Neovim installation.',
    target: 'settings-page',
    tooltipPlacement: 'bottom',
    advanceCondition: { type: 'click-next' },
    requiredRoute: '/settings',
  },

  // ─── STEP 10: CONCLUSION ──────────────────────────────────
  {
    id: 'conclusion',
    section: 'conclusion',
    title: "You're All Set!",
    content:
      "You've completed the tutorial! You now know how to:\n\n" +
      '• **Install plugins** to extend Neovim\n' +
      '• **Create keyboard shortcuts** for quick actions\n' +
      '• **Configure Neovim options** for your workflow\n' +
      '• **Browse color schemes** to customize appearance\n' +
      '• **Build custom actions** in the Graph Editor (advanced)\n' +
      '• **Customize app settings** and set your output path\n\n' +
      "You're ready to create your own Neovim configuration!",
    hint: 'You can replay this tutorial anytime from Settings.',
    target: null,
    tooltipPlacement: 'center',
    advanceCondition: { type: 'click-next' },
    requiredRoute: null,
    allowBack: false,
  },
] as const
