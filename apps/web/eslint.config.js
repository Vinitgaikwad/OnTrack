import config from 'eslint-config-turbotron/web.eslint.mjs'

export default [
  { ignores: ['dist'] },
  ...config,
]