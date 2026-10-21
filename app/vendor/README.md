Third-party code, copied unmodified so the app works offline without a CDN.

| File | Package | Source | License |
| --- | --- | --- | --- |
| van-1.6.1.js | vanjs-core 1.6.1 | https://github.com/vanjs-org/van (src/van.js) | MIT (LICENSE-vanjs) |
| van-x-0.6.3.js | vanjs-ext 0.6.3 | https://github.com/vanjs-org/van (x/src/van-x.js) | MIT |

`van-x` imports `"vanjs-core"`; index.html maps that name to `./vendor/van-1.6.1.js`
with an import map. To upgrade: `npm pack vanjs-core@X vanjs-ext@Y`, copy the
`src/` files here under the new names, and update the import map and `sw.js`.
