// Single-file artifact for Supabase Dashboard's code editor; secrets stay in Deno.env.
import {build} from 'vite';
await build({configFile:false,publicDir:false,build:{target:'es2022',outDir:'tmp/farmer-chat-deploy',emptyOutDir:false,minify:false,
  lib:{entry:'supabase/functions/farmer-chat/index.ts',formats:['es'],fileName:()=> 'index.ts'},
  rolldownOptions:{external:id=>id.startsWith('npm:')},
}});
console.log('Prepared tmp/farmer-chat-deploy/index.ts. Set Supabase Secrets separately.');
