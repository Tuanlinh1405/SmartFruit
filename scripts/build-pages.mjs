// Build a static Pages artifact. Only public browser configuration enters Vite.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { stdio: 'inherit' });
const base = '/onlmallfruit/';
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--base', base], { stdio: 'inherit' });
const inventory = await readFile('src/app/ui-inventory.ts', 'utf8');
const paths = new Set([...inventory.matchAll(/path:\s*['"]([^'"]+)['"]/g)].map(match => match[1]));
let rolePrefix;
for (const line of inventory.split('\n')) {
  const role = line.match(/\.\.\.pages\('(FARMER|BUYER|CARRIER|ADMIN)'/);
  if (role) rolePrefix = `/${role[1].toLowerCase()}`;
  if (line.trim() === ']),') rolePrefix = undefined;
  if (rolePrefix) for (const match of line.matchAll(/\['[A-Z]+-\d+','[^']*','([^']+)'/g)) paths.add(`${rolePrefix}/${match[1]}`);
}
for (const path of ['/login','/register','/auth/login','/auth/register','/role-home','/403','/404','/farmer','/buyer','/carrier','/admin',
  '/buyer/profile','/buyer/requests','/buyer/requests/new','/buyer/lots','/buyer/invitations','/buyer/negotiations','/buyer/chat','/buyer/reviews',
  '/buyer/transport','/buyer/policy','/buyer/map','/buyer/notifications','/farmer/chat','/farmer/negotiations']) paths.add(path);
for (const path of ['/policy','/farmer/policy','/carrier/policy','/carrier/notifications','/admin/notifications','/carrier/profile','/carrier/transport','/farmer/invitations',
  ...['buyers','farmers','carriers','marketplace','connections','transport','policy'].map(section => `/admin/${section}`)]) paths.add(path);
// Static routes return HTTP 200 on reload; dynamic IDs use the custom 404 SPA.
for (const path of paths) {
  if (!/^\/[a-z0-9/-]+$/.test(path)) continue;
  await mkdir(`dist${path}`, { recursive: true });
  await copyFile('dist/index.html', `dist${path}/index.html`);
}
await copyFile('dist/index.html', 'dist/404.html');
await writeFile('dist/.nojekyll', '');
console.log(`Pages artifact prepared for ${base} (${paths.size} route entries).`);
