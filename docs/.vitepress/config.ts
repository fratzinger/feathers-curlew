import { defineConfig } from 'vitepress'

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
    ],
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
          { text: 'Configuration', link: '/guide/config' },
        ],
      },
    ],
  },
})
