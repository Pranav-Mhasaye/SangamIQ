// Voice AI Evaluation Script for SangamIQ.
// Evaluates accuracy across 60+ phrases (Marathi, Hindi, English, Hinglish, Romanised, Noisy).
// Prints accuracy per intent and per language.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../src/voice.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evalFile = path.resolve(__dirname, '../test/voice-eval.json');

async function runEvaluation() {
  console.log('========================================================================');
  console.log('                 SangamIQ Voice AI Accuracy Benchmark                   ');
  console.log('========================================================================\n');

  if (!fs.existsSync(evalFile)) {
    console.error(`Evaluation file not found: ${evalFile}`);
    process.exit(1);
  }

  const cases = JSON.parse(fs.readFileSync(evalFile, 'utf8'));
  console.log(`Loaded ${cases.length} evaluation test cases across all supported languages.\n`);

  let totalCount = 0;
  let overallPassed = 0;
  let safetyTotal = 0;
  let safetyPassed = 0;

  const perIntent = {};
  const perLang = {};

  const failures = [];

  for (const c of cases) {
    totalCount++;
    const langKey = c.lang || 'en';
    const intentKey = c.expectedIntent;

    if (!perIntent[intentKey]) perIntent[intentKey] = { total: 0, passed: 0 };
    if (!perLang[langKey]) perLang[langKey] = { total: 0, passed: 0 };

    perIntent[intentKey].total++;
    perLang[langKey].total++;

    if (c.category === 'safety') safetyTotal++;

    const res = await classify(c.phrase, { language: c.lang === 'mr' || c.lang === 'hi' ? c.lang : 'en' });

    const intentMatches = res.intent === c.expectedIntent;
    const typeMatches = res.type === c.expectedType;
    const emergencyMatches = Boolean(res.emergency) === Boolean(c.expectedEmergency);

    const isPass = intentMatches && typeMatches && emergencyMatches;

    if (c.category === 'safety') {
      if (res.emergency === true && res.priority === 'critical') {
        safetyPassed++;
      }
    }

    if (isPass) {
      overallPassed++;
      perIntent[intentKey].passed++;
      perLang[langKey].passed++;
    } else {
      failures.push({
        phrase: c.phrase,
        lang: c.lang,
        expected: { intent: c.expectedIntent, type: c.expectedType, emergency: c.expectedEmergency },
        got: { intent: res.intent, type: res.type, emergency: res.emergency, confidence: res.confidence },
        reason: !intentMatches ? 'intent mismatch' : !typeMatches ? 'type mismatch' : 'emergency mismatch',
      });
    }
  }

  // 1. Overall Accuracy
  const overallAcc = ((overallPassed / totalCount) * 100).toFixed(1);
  const safetyAcc = safetyTotal > 0 ? ((safetyPassed / safetyTotal) * 100).toFixed(1) : '100.0';

  console.log('📊 ACCURACY SUMMARY:');
  console.log(`------------------------------------------------------------------------`);
  console.log(`Total Cases Evaluated:   ${totalCount}`);
  console.log(`Overall Pass Rate:       ${overallPassed}/${totalCount} (${overallAcc}%)`);
  console.log(`Life Safety Compliance:  ${safetyPassed}/${safetyTotal} (${safetyAcc}%) [Chest pain, unconscious, bleeding, etc.]`);
  console.log(`------------------------------------------------------------------------\n`);

  // 2. Breakdown per Intent
  console.log('🎯 BREAKDOWN BY INTENT:');
  console.log('Intent                    | Passed | Total | Accuracy');
  console.log('--------------------------+--------+-------+---------');
  for (const [intent, stat] of Object.entries(perIntent)) {
    const pct = ((stat.passed / stat.total) * 100).toFixed(1);
    console.log(`${intent.padEnd(25)} | ${String(stat.passed).padStart(6)} | ${String(stat.total).padStart(5)} | ${pct.padStart(6)}%`);
  }
  console.log('------------------------------------------------------------------------\n');

  // 3. Breakdown per Language
  console.log('🌐 BREAKDOWN BY LANGUAGE / DIALECT:');
  console.log('Language / Style          | Passed | Total | Accuracy');
  console.log('--------------------------+--------+-------+---------');
  for (const [lang, stat] of Object.entries(perLang)) {
    const pct = ((stat.passed / stat.total) * 100).toFixed(1);
    console.log(`${lang.padEnd(25)} | ${String(stat.passed).padStart(6)} | ${String(stat.total).padStart(5)} | ${pct.padStart(6)}%`);
  }
  console.log('------------------------------------------------------------------------\n');

  if (failures.length > 0) {
    console.log(`⚠️ MISMATCHES (${failures.length}):`);
    failures.forEach((f, idx) => {
      console.log(` [${idx + 1}] "${f.phrase}" (${f.lang})`);
      console.log(`     Expected: ${JSON.stringify(f.expected)}`);
      console.log(`     Got:      ${JSON.stringify(f.got)} -> ${f.reason}`);
    });
    console.log('');
  }

  if (safetyPassed !== safetyTotal) {
    console.error('❌ SAFETY FAILURE: 100% compliance required on emergency/critical safety terms!');
    process.exit(1);
  }

  if (Number(overallAcc) < 85) {
    console.error(`❌ Benchmark failed: Overall accuracy ${overallAcc}% is below 85% threshold.`);
    process.exit(1);
  }

  console.log('✅ ALL VOICE AI BENCHMARK CRITERIA MET SUCCESSFULLY!\n');
}

runEvaluation().catch((err) => {
  console.error('Fatal evaluation error:', err);
  process.exit(1);
});
