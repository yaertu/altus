import {copyFile,mkdir} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'

const assets=['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs']

for(const asset of assets){
  const source=resolve('node_modules/maplibre-gl/dist',asset)
  const target=resolve('public',asset)
  await mkdir(dirname(target),{recursive:true})
  await copyFile(source,target)
}
