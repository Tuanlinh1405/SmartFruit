// Prepare only the three server secrets required by farmer-chat. Never print their values.
import {mkdir,writeFile} from 'node:fs/promises';
try { process.loadEnvFile('.env.local'); } catch { /* environment may be supplied by CI */ }
const argument=process.argv.find(a=>a.startsWith('--origin='));
if(!argument)throw Error('Provide --origin=https://your-deployed-site.example (the actual frontend origin).');
const origin=new URL(argument.slice('--origin='.length));
if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw Error('Use only the HTTPS frontend origin, without a page path or credentials.');
const apiKey=process.env.OPENROUTER_API_KEY?.trim();
if(!apiKey||/[\r\n]/.test(apiKey))throw Error('Missing valid OPENROUTER_API_KEY in .env.local or the environment.');
const model=process.env.OPENROUTER_MODEL?.trim()||'openrouter/free';
if(model!=='openrouter/free'&&!/^[a-zA-Z0-9._/-]+:free$/.test(model))throw Error('Only openrouter/free or a :free catalog model is allowed.');
const origins=new Set([origin.origin,'http://localhost:5173','http://127.0.0.1:5173']);
const file='tmp/farmer-chat-openrouter.env';await mkdir('tmp',{recursive:true});
await writeFile(file,Object.entries({OPENROUTER_API_KEY:apiKey,OPENROUTER_MODEL:model,FARMER_CHAT_ALLOWED_ORIGINS:[...origins].join(',')}).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join('\n')+'\n',{mode:0o600});
console.log('Prepared '+file+' (gitignored). No secret values were printed.');
