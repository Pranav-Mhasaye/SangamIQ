import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, replyFor } from '../src/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'voice-cases.json'), 'utf8'));

let passed = 0;
let failed = 0;

for (const c of cases) {
  const res = classify(c.phrase);
  const reply = replyFor(res, c.lang);

  const intentOk = res.intent === c.expectedIntent;
  const typeOk = res.type === c.expectedType;
  const priorityOk = !c.expectedPriority || res.priority === c.expectedPriority;
  const notUnknown = !reply.includes('did not understand') && !reply.includes('समझ नहीं पाया') && !reply.includes('समजले नाही');

  if (intentOk && typeOk && priorityOk && notUnknown) {
    passed++;
  } else {
    failed++;
    console.error(`FAIL: "${c.phrase}" (${c.lang}) ->`, { got: res, reply, expected: c });
  }
}

console.log(`Voice test results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
