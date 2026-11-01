import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(specifier, context, defaultResolve) {
  if (specifier === 'next/server') {
    return defaultResolve('next/server.js', context)
  }
  if (specifier.startsWith('@/')) {
    const subpath = specifier.slice(2)
    const filePath = path.resolve('src', subpath + (path.extname(subpath) ? '' : '.ts'))
    return defaultResolve(pathToFileURL(filePath).href, context)
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL && !path.extname(specifier)) {
    const parentDir = path.dirname(fileURLToPath(context.parentURL))
    const candidateTs = path.resolve(parentDir, specifier + '.ts')
    if (fs.existsSync(candidateTs)) {
      return defaultResolve(pathToFileURL(candidateTs).href, context)
    }
    const candidateJs = path.resolve(parentDir, specifier + '.js')
    if (fs.existsSync(candidateJs)) {
      return defaultResolve(pathToFileURL(candidateJs).href, context)
    }
  }
  return defaultResolve(specifier, context)
}
