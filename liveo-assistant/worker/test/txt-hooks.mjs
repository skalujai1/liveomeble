// Pozwala zaimportować plik .txt w Node tak jak robi to wrangler (moduł "Text").
import { readFile } from 'node:fs/promises';
export async function load(url, context, next) {
  if (url.endsWith('.txt')) {
    const text = await readFile(new URL(url), 'utf8');
    return { format: 'module', source: `export default ${JSON.stringify(text)};`, shortCircuit: true };
  }
  return next(url, context);
}
