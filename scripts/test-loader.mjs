import path from 'node:path'
import { pathToFileURL } from 'node:url'

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('@/')) {
    const subpath = specifier.slice(2)
    const filePath = path.resolve('src', subpath + (path.extname(subpath) ? '' : '.ts'))
    return defaultResolve(pathToFileURL(filePath).href, context)
  }
  return defaultResolve(specifier, context)
}
