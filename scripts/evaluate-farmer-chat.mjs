// Opt-in real Gemini smoke/evaluation with synthetic questions only. No Supabase credentials needed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) throw new Error('Set GEMINI_API_KEY locally. Never commit it or use a VITE_ variable.');
const argument = process.argv.find(value => value.startsWith('--limit='));
const limit = argument ? Number(argument.slice('--limit='.length)) : 1;
if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('--limit must be between 1 and 30; default is one real request.');
const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const target = path.resolve('tmp/farmer-chat-evaluation');
await fs.mkdir(target, { recursive: true });
const source = await fs.readFile('supabase/functions/farmer-chat/service.ts', 'utf8');
const compiled = stripTypeScriptTypes(source, { mode: 'transform' });
await fs.writeFile(path.join(target, 'service.mjs'), compiled);
await fs.copyFile('supabase/functions/farmer-chat/knowledge.json', path.join(target, 'knowledge.json'));
const { generateAnswer } = await import(pathToFileURL(path.join(target, 'service.mjs')).href);
const cases = JSON.parse(await fs.readFile('tests/fixtures/farmer-chat-evaluation.json', 'utf8'));
const results = [];
for (const entry of cases.slice(0, limit)) {
  const started = Date.now();
  const input = { crop: entry.crop, topic: entry.topic, growthStage: entry.growthStage, question: entry.question };
  try {
    const result = await generateAnswer(input, { apiKey, model, requestId: crypto.randomUUID() });
    results.push({ id: entry.id, rubric: entry.rubric, ...result, durationMs: Date.now() - started, humanReview: 'pending' });
    console.log(JSON.stringify({ id: entry.id, code: 'OK', durationMs: Date.now() - started, usage: result.usage }));
  } catch (error) {
    // Do not print provider messages, request data or secrets. Stop on first failure to avoid burning quota.
    const code = typeof error?.code === 'string' ? error.code : 'UNAVAILABLE';
    const providerStatus = typeof error?.providerStatus === 'number' ? error.providerStatus : undefined;
    const providerCode = typeof error?.providerCode === 'string' ? error.providerCode : undefined;
    results.push({ id: entry.id, code, providerStatus, providerCode, durationMs: Date.now() - started });
    console.log(JSON.stringify({ id: entry.id, code, providerStatus, providerCode, durationMs: Date.now() - started }));
    process.exitCode = 1; break;
  }
}
await fs.writeFile(path.join(target, 'results.json'), JSON.stringify({ model, generatedAt: new Date().toISOString(), requested: limit, completed: results.length, results }, null, 2));
console.log('Synthetic evaluation saved to tmp/farmer-chat-evaluation/results.json. Successful parsing/source checks do not replace human agronomy review.');
