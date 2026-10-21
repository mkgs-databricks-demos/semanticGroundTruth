import { createHash } from 'node:crypto';

export function computeVersionHash(yamlContent: string): string {
  const normalised = yamlContent
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');
  return createHash('sha256').update(normalised, 'utf-8').digest('hex');
}
