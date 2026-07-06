import { createRequire } from 'node:module'
import { defineConfig } from 'vitepress'

const require = createRequire(import.meta.url)
const pkg = require('../../package.json')

const repo = 'https://github.com/fratzinger/feathers-curlew'

export default defineConfig({
  title: 'feathers-curlew',
  description: 'AI-friendly CLI toolkit for driving FeathersJS v5 servers.',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Configuration', link: '/guide/config' },
      {
        text: `v${pkg.version}`,
        items: [
          { text: 'Release Notes', link: `${repo}/releases` },
          { text: 'npm', link: `https://www.npmjs.com/package/${pkg.name}` },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'In-Process Mode', link: '/guide/in-process' },
          { text: 'Remote Mode', link: '/guide/remote' },
          { text: 'Permissions', link: '/guide/permissions' },
          { text: 'Custom Commands', link: '/guide/custom-commands' },
          { text: 'Plugins', link: '/guide/plugins' },
          { text: 'AI Agents', link: '/guide/ai-agents' },
          { text: 'Configuration', link: '/guide/config' },
        ],
      },
    ],
  },
})
