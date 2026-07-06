import feathers from '@feathers-community/eslint-config'

export default feathers(
  {},
  {
    ignores: ['dist', 'docs/.vitepress/**', 'eslint.config.mjs'],
  },
)
