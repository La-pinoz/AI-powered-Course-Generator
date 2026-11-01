import { createSystem, defaultConfig, defineConfig } from '@chakra-ui/react'

// Every color below points at a Tailwind theme variable (`@theme static` in src/index.css), so the
// palette is defined once, in the Tailwind theme, and not repeated here.
const color = (name) => ({ value: `var(--color-app-${name})` })
const tint = (name, percent) => ({
  value: `color-mix(in srgb, var(--color-app-${name}) ${percent}%, transparent)`,
})

// Chakra is mounted only inside the dashboard layout. The landing page stays on Tailwind, so:
// - `preflight: false`: Tailwind's preflight is already global; don't reset twice.
// - the default `html { color; background }` rule is neutralised, because Chakra's styles stay in
//   <head> after the user navigates back to the landing page.
const config = defineConfig({
  preflight: false,
  globalCss: {
    '*': { fontFeatureSettings: 'normal' },
    html: { color: 'unset', bg: 'unset' },
    // The layout puts `.dark` on <html> only while it is mounted, so these never apply to the landing
    // page. Portaled UI (dialogs, the drawer, menus) inherits its text color from <html>.
    'html.dark': { color: 'fg' },
    '@media (prefers-reduced-motion: reduce)': {
      '.dark *, .dark *::before, .dark *::after': {
        animation: 'none !important',
        transition: 'none !important',
      },
    },
  },
  theme: {
    tokens: {
      // The landing page's fonts (defined in index.css).
      fonts: {
        heading: { value: 'var(--font-heading)' },
        body: { value: 'var(--font-body)' },
      },
    },
    semanticTokens: {
      colors: {
        bg: {
          DEFAULT: color('bg'),
          app: color('bg'),
          sidebar: color('sidebar'),
          panel: color('surface'), // cards, inputs, menus, dialogs
          subtle: color('surface'),
          muted: color('border'), // hover and track backgrounds
          emphasized: color('border'),
        },
        fg: { DEFAULT: color('text'), muted: color('muted'), subtle: color('muted') },
        text: { muted: color('muted') },
        border: { DEFAULT: color('border'), subtle: color('border'), muted: color('border'), emphasized: color('border') },
        // Also a Chakra color palette (`colorPalette="accent"`): checkboxes, radio cards, spinners.
        accent: {
          DEFAULT: color('accent'),
          solid: color('accent'),
          contrast: color('bg'),
          fg: color('accent'),
          muted: tint('accent', 25),
          subtle: tint('accent', 15),
          emphasized: tint('accent', 35),
          focusRing: color('accent'),
        },
        success: color('success'),
        brand: color('brand'),
        danger: { fg: color('danger'), bg: color('danger-surface') },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)
