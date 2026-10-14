import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = (await readdir(path.join(root, 'migrations'))).filter(f => f.endsWith('.sql')).sort();
const sections = [];
for (const file of files) {
  const sql = await readFile(path.join(root, 'migrations', file), 'utf8');
  sections.push(`-- SOURCE: migrations/${file}\n${sql.replace(/^begin;\r?$/gm, '').replace(/^commit;\r?$/gm, '')}`);
}
const seed = await readFile(path.join(root, 'seed.sql'), 'utf8');
sections.push(`-- SOURCE: seed.sql\n${seed.replace(/^begin;\r?$/gm, '').replace(/^commit;\r?$/gm, '')}`);
const output = `-- GENERATED. Regenerate with node supabase/scripts/build-deploy.mjs\n-- Target project: yyslykqpamnlqkvutrlm. Review preflight.sql first.\n-- Initial install ONLY. Do not run again after successful installation.\nbegin;\n${sections.join('\n\n')}\ncommit;\n`;
await writeFile(path.join(root, 'deploy.sql'), output, 'utf8');
console.log('Built supabase/deploy.sql as one atomic transaction (schema + reference catalog).');
