// Bundle repo-local TypeScript for the Dashboard editor; do not bundle credentials.
import {build} from 'rolldown';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=[];
for(const name of ['search-matches','process-embeddings','farmer-chat']) {
  const result=await build({input:`supabase/functions/${name}/index.ts`,external:id=>id.startsWith('npm:'),
    output:{format:'esm',minify:false,sourcemap:false}});
  const code=result.output.find(item=>item.type==='chunk').code;
  if(/from ['"]\.{1,2}\//.test(code))throw new Error('Unresolved relative dependency');
  await mkdir(`tmp/edge/${name}`,{recursive:true});
  await writeFile(`tmp/edge/${name}/index.ts`,code);
  manifest.push({name,bytes:Buffer.byteLength(code),sha256:createHash('sha256').update(code).digest('hex')});
}
await writeFile('tmp/edge/manifest.json',JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest));
