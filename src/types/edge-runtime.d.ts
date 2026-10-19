declare module 'npm:@supabase/supabase-js@2.117.3' {
  export { createClient } from '@supabase/supabase-js';
}

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};
