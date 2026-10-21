import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, readdirSync, statSync} from 'node:fs';

// Vercel production must receive browser-safe configuration explicitly.
if (process.env.VERCEL) {
  const {VITE_SUPABASE_URL:url, VITE_SUPABASE_PUBLISHABLE_KEY:key} = process.env;
  if (!url?.startsWith('https://') || !key?.startsWith('sb_publishable_')) {
    throw new Error('Set the public Supabase URL and publishable key in Vercel.');
  }
}
const run = args => execFileSync(process.execPath, args, {stdio:'inherit'});
run(['node_modules/vitest/vitest.mjs','run',process.platform === 'win32' ? '--pool=threads' : '--pool=forks','--maxWorkers=2','--testTimeout=20000']);
run(['node_modules/typescript/bin/tsc','--noEmit']);
run(['node_modules/vite/bin/vite.js','build','--base','/']);
const sha = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
writeFileSync('dist/deploy-info.json', JSON.stringify({source_commit:sha,base:'/',built_at:new Date().toISOString()})+'\n');
// Publish dist only. Refuse accidental private keys in the browser bundle.
function scan(directory) {
  for (const name of readdirSync(directory)) {
    const file = `${directory}/${name}`;
    if (statSync(file).isDirectory()) { scan(file); continue; }
    if (/\.env|\.map$|\.sql$|\.md$/.test(name)) throw new Error(`Unexpected public artifact: ${name}`);
    if (/sb_secret_[\w-]{16,}|(?:ghp_|github_pat_)[\w]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|eyJ[\w-]{20,}\.[\w-]{20,}\.[\w-]{20,}/.test(readFileSync(file,'utf8'))) {
      throw new Error(`Private credential found in public artifact: ${name}`);
    }
  }
}
scan('dist');
console.log('Vercel artifact checked; tests and typecheck passed.');
