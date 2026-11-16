// Pluggable LLM Intent Classifier for SangamIQ Voice AI.
// Providers: Gemini, Claude, OpenAI, or Keyword fallback.
// Enforces strict JSON output schema and validates all fields.

import { classifyKeyword } from './keyword.js';

const SYSTEM_PROMPT = `You are SangamIQ Voice AI, an emergency and crowd safety assistant for large Indian gatherings (Wari pilgrimage in Alandi/Pune, Kumbh Mela, festivals).
Your job is to analyze the user's spoken or typed input in Marathi, Hindi, English, Hinglish, or Romanised Marathi.

You must respond ONLY with valid JSON matching this exact structure:
{
  "intent": "request_help" | "find_service" | "report_lost_person" | "ask_info" | "unknown",
  "type": "medical" | "water" | "food" | "toilet" | "helpdesk" | "transport" | null,
  "emergency": boolean,
  "urgency": integer between 1 and 5,
  "confidence": float between 0.0 and 1.0,
  "extractedDetails": {
    "who": string or null,
    "symptoms": string or null,
    "landmark": string or null
  },
  "reply": "Short, clear reply in the user's language (Marathi/Hindi/English)"
}

Rules:
1. "intent":
   - "request_help": attendee needs assistance brought to them (e.g. sick, thirsty, hungry, can't walk).
   - "find_service": attendee is asking where a place is or asking for walking directions (e.g. "where is water", "doctor kidhar hai", "toilet kuthe ahe").
   - "report_lost_person": missing child, elderly person, or separated family member.
   - "ask_info": event timings, schedules, aarti times.
   - "unknown": non-relevant, chit-chat, or completely unintelligible.
2. "type":
   - "medical", "water", "food", "toilet", "helpdesk", "transport".
   - If report_lost_person or ask_info, set type="helpdesk".
   - If unknown, set type=null.
3. "emergency": true if life/health danger or severe distress; false otherwise.
4. "urgency": 1 (low) to 5 (life critical).
5. "confidence": float between 0.1 and 1.0 reflecting your confidence in the classification.
6. "reply": Short, polite sentence in the user's language. Never give medical prescriptions or advice beyond telling them help is coming.
7. Return ONLY the raw JSON object without markdown or code fences.`;

export function validateLLMOutput(data) {
  if (!data || typeof data !== 'object') return false;

  const validIntents = ['request_help', 'find_service', 'report_lost_person', 'ask_info', 'unknown', 'generic_help'];
  const validTypes = ['medical', 'water', 'food', 'toilet', 'helpdesk', 'transport', null];

  if (!validIntents.includes(data.intent)) return false;
  if (!validTypes.includes(data.type)) return false;
  if (typeof data.emergency !== 'boolean') return false;

  const urgency = Number(data.urgency);
  if (!Number.isInteger(urgency) || urgency < 1 || urgency > 5) return false;

  const confidence = Number(data.confidence);
  if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) return false;

  if (!data.reply || typeof data.reply !== 'string') return false;

  if (!data.extractedDetails || typeof data.extractedDetails !== 'object') {
    data.extractedDetails = { who: null, symptoms: null, landmark: null };
  }

  return true;
}

/**
 * Call Gemini API with strict JSON
 */
async function callGemini(apiKey, text, language, timeoutMs = 4000) {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `Language context: ${language || 'auto'}\nUser statement: "${text}"`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) throw new Error('No candidate returned from Gemini');

    return JSON.parse(rawJson);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call Claude API with strict JSON
 */
async function callClaude(apiKey, text, language, timeoutMs = 4000) {
  const model = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';
  const url = 'https://api.anthropic.com/v1/messages';

  const prompt = `Language context: ${language || 'auto'}\nUser statement: "${text}"`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.1,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

    const data = await res.json();
    const rawContent = data.content?.[0]?.text || '';
    const cleaned = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call OpenAI API with JSON mode
 */
async function callOpenAI(apiKey, text, language, timeoutMs = 4000) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const prompt = `Language context: ${language || 'auto'}\nUser statement: "${text}"`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);

    const data = await res.json();
    const rawJson = data.choices?.[0]?.message?.content;
    return JSON.parse(rawJson);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Classify text using configured LLM provider with fallback to keyword classifier.
 */
export async function classifyWithLLM(text, options = {}) {
  const language = options.language || 'en';
  const provider = (process.env.LLM_PROVIDER || '').toLowerCase();

  // Determine provider
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  let activeProvider = provider;
  if (!activeProvider) {
    if (geminiKey) activeProvider = 'gemini';
    else if (anthropicKey) activeProvider = 'claude';
    else if (openaiKey) activeProvider = 'openai';
    else activeProvider = 'keyword';
  }

  if (activeProvider === 'keyword' || activeProvider === 'none') {
    return { ...classifyKeyword(text, options), provider: 'keyword' };
  }

  try {
    let result = null;
    if (activeProvider === 'gemini' && geminiKey) {
      result = await callGemini(geminiKey, text, language);
    } else if (activeProvider === 'claude' && anthropicKey) {
      result = await callClaude(anthropicKey, text, language);
    } else if (activeProvider === 'openai' && openaiKey) {
      result = await callOpenAI(openaiKey, text, language);
    } else {
      // Missing API key -> keyword fallback
      return { ...classifyKeyword(text, options), provider: 'keyword' };
    }

    if (result && validateLLMOutput(result)) {
      const priority = result.emergency
        ? 'critical'
        : result.urgency >= 4
        ? 'high'
        : 'normal';

      const needsConfirmation = result.confidence < 0.75 && result.intent !== 'unknown';

      return {
        ...result,
        priority,
        needsConfirmation,
        confirmationPrompt: needsConfirmation
          ? `Did you say you need ${result.type || 'help'}?`
          : null,
        provider: activeProvider,
      };
    }
  } catch (err) {
    // Graceful fallback to keyword on network timeout, invalid schema, or rate-limit
    // Raw audio is never logged.
  }

  return { ...classifyKeyword(text, options), provider: 'keyword_fallback' };
}
