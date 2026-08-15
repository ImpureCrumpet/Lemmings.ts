# Dependency license inventory

This file is generated from `package.json` and `package-lock.json`. Run
`npm run licenses:inventory` after changing dependencies, and
`npm run licenses:check` to detect a stale inventory. Package links use the
locked registry source where available. License values are package metadata,
not an independent legal conclusion.

## Production installation graph

This is a conservative list of locked, non-development packages in a production
installation. A bundler may tree-shake some of them from a specific build.

| Package | Locked version | Declared license | Relationship |
| --- | --- | --- | --- |
| [@babel/helper-string-parser](https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.29.7.tgz) | 7.29.7 | MIT | transitive |
| [@babel/helper-validator-identifier](https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.29.7.tgz) | 7.29.7 | MIT | transitive |
| [@babel/parser](https://registry.npmjs.org/@babel/parser/-/parser-7.29.8.tgz) | 7.29.8 | MIT | transitive |
| [@babel/types](https://registry.npmjs.org/@babel/types/-/types-7.29.8.tgz) | 7.29.8 | MIT | transitive |
| [@jridgewell/sourcemap-codec](https://registry.npmjs.org/@jridgewell/sourcemap-codec/-/sourcemap-codec-1.5.5.tgz) | 1.5.5 | MIT | transitive |
| [@vue/compiler-core](https://registry.npmjs.org/@vue/compiler-core/-/compiler-core-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/compiler-dom](https://registry.npmjs.org/@vue/compiler-dom/-/compiler-dom-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/compiler-sfc](https://registry.npmjs.org/@vue/compiler-sfc/-/compiler-sfc-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/compiler-ssr](https://registry.npmjs.org/@vue/compiler-ssr/-/compiler-ssr-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/devtools-api](https://registry.npmjs.org/@vue/devtools-api/-/devtools-api-6.6.4.tgz) | 6.6.4 | MIT | transitive |
| [@vue/reactivity](https://registry.npmjs.org/@vue/reactivity/-/reactivity-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/runtime-core](https://registry.npmjs.org/@vue/runtime-core/-/runtime-core-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/runtime-dom](https://registry.npmjs.org/@vue/runtime-dom/-/runtime-dom-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/server-renderer](https://registry.npmjs.org/@vue/server-renderer/-/server-renderer-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [@vue/shared](https://registry.npmjs.org/@vue/shared/-/shared-3.5.41.tgz) | 3.5.41 | MIT | transitive |
| [csstype](https://registry.npmjs.org/csstype/-/csstype-3.2.3.tgz) | 3.2.3 | MIT | transitive |
| [entities](https://registry.npmjs.org/entities/-/entities-7.0.1.tgz) | 7.0.1 | BSD-2-Clause | transitive |
| [estree-walker](https://registry.npmjs.org/estree-walker/-/estree-walker-2.0.2.tgz) | 2.0.2 | MIT | transitive |
| [magic-string](https://registry.npmjs.org/magic-string/-/magic-string-0.30.21.tgz) | 0.30.21 | MIT | transitive |
| [nanoid](https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz) | 3.3.18 | MIT | transitive |
| [picocolors](https://registry.npmjs.org/picocolors/-/picocolors-1.1.1.tgz) | 1.1.1 | ISC | transitive |
| [postcss](https://registry.npmjs.org/postcss/-/postcss-8.5.26.tgz) | 8.5.26 | MIT | transitive |
| [source-map-js](https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.1.tgz) | 1.2.1 | BSD-3-Clause | transitive |
| [vue](https://registry.npmjs.org/vue/-/vue-3.5.41.tgz) | 3.5.41 | MIT | direct |
| [vue-router](https://registry.npmjs.org/vue-router/-/vue-router-4.6.4.tgz) | 4.6.4 | MIT | direct |

## Direct development tools

Development-only transitive packages are recorded by `package-lock.json` but
are not repeated here because they are not shipped in the browser build.

| Package | Locked version | Declared license | Relationship |
| --- | --- | --- | --- |
| [@eslint/js](https://registry.npmjs.org/@eslint/js/-/js-10.0.1.tgz) | 10.0.1 | MIT | direct development |
| [@types/node](https://registry.npmjs.org/@types/node/-/node-24.13.3.tgz) | 24.13.3 | MIT | direct development |
| [@vitejs/plugin-vue](https://registry.npmjs.org/@vitejs/plugin-vue/-/plugin-vue-6.0.8.tgz) | 6.0.8 | MIT | direct development |
| [eslint](https://registry.npmjs.org/eslint/-/eslint-10.8.1.tgz) | 10.8.1 | MIT | direct development |
| [eslint-plugin-vue](https://registry.npmjs.org/eslint-plugin-vue/-/eslint-plugin-vue-10.10.0.tgz) | 10.10.0 | MIT | direct development |
| [eslint-plugin-vuejs-accessibility](https://registry.npmjs.org/eslint-plugin-vuejs-accessibility/-/eslint-plugin-vuejs-accessibility-2.6.0.tgz) | 2.6.0 | MIT | direct development |
| [sass](https://registry.npmjs.org/sass/-/sass-1.102.0.tgz) | 1.102.0 | MIT | direct development |
| [typescript](https://registry.npmjs.org/typescript/-/typescript-6.0.3.tgz) | 6.0.3 | Apache-2.0 | direct development |
| [typescript-eslint](https://registry.npmjs.org/typescript-eslint/-/typescript-eslint-8.67.0.tgz) | 8.67.0 | MIT | direct development |
| [vite](https://registry.npmjs.org/vite/-/vite-8.2.1.tgz) | 8.2.1 | MIT | direct development |
| [vitest](https://registry.npmjs.org/vitest/-/vitest-4.1.10.tgz) | 4.1.10 | MIT | direct development |
| [vue-eslint-parser](https://registry.npmjs.org/vue-eslint-parser/-/vue-eslint-parser-10.4.1.tgz) | 10.4.1 | MIT | direct development |
| [vue-tsc](https://registry.npmjs.org/vue-tsc/-/vue-tsc-3.3.9.tgz) | 3.3.9 | MIT | direct development |
