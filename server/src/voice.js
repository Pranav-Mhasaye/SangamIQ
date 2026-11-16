// SangamIQ Voice AI - Upgraded from keyword matching to real voice AI with LLM & STT
// Maintains return shape: { intent, type, emergency, reply } along with enriched fields.

import { checkSafetyOverride, SAFETY_REPLIES } from './voice/safety.js';
import { classifyKeyword } from './voice/keyword.js';
import { classifyWithLLM } from './voice/llm.js';
import { transcribeAudio } from './voice/stt.js';
import { synthesizeSpeech } from './voice/tts.js';

export { checkSafetyOverride, transcribeAudio, synthesizeSpeech, classifyKeyword };

export const LABEL = {
  medical: { en: 'medical help', hi: 'चिकित्सा सहायता', mr: 'वैद्यकीय मदत' },
  water: { en: 'drinking water', hi: 'पीने का पानी', mr: 'पिण्याचे पाणी' },
  food: { en: 'food', hi: 'भोजन', mr: 'अन्न' },
  toilet: { en: 'a toilet', hi: 'शौचालय', mr: 'स्वच्छतागृह' },
  helpdesk: { en: 'the help desk', hi: 'सहायता केंद्र', mr: 'मदत केंद्र' },
  transport: { en: 'transport', hi: 'परिवहन', mr: 'वाहतूक' },
};

const CONFIRMATION_PROMPTS = {
  en: (label) => `Did you say you need ${label}? Say yes or no.`,
  hi: (label) => `क्या आपने कहा कि आपको ${label} चाहिए? हाँ या नहीं कहें।`,
  mr: (label) => `तुम्हाला ${label} हवे आहे असे म्हणालात का? होय किंवा नाही म्हणा.`,
};

export const AFFIRMATIVE_WORDS = [
  'yes', 'yeah', 'yep', 'correct', 'sure', 'confirm', 'right',
  'हाँ', 'हां', 'सही', 'ठीक', 'हाँ जी', 'ha', 'haan', 'sahi',
  'हो', 'होय', 'बरोबर', 'नक्की', 'होय मला हवे', 'barobar', 'hoy'
];

export const NEGATIVE_WORDS = [
  'no', 'nope', 'nah', 'wrong', 'cancel', 'not this',
  'नहीं', 'गलत', 'ना', 'nahi', 'galat', 'na',
  'नाही', 'नको', 'चूक', 'nahi', 'nako', 'chook'
];

/**
 * Check if text contains life safety critical words
 */
export function isCritical(text = '') {
  return checkSafetyOverride(text).triggered;
}

/**
 * Handle multi-turn yes/no confirmation
 */
export function handleConfirmation(text = '', pendingAction = null, language = 'en') {
  const L = ['mr', 'hi', 'en'].includes(language) ? language : 'en';
  const lower = text.toLowerCase().trim();

  const isYes = AFFIRMATIVE_WORDS.some((w) => lower === w || lower.includes(` ${w} `) || lower.startsWith(`${w} `) || lower.endsWith(` ${w}`));
  const isNo = NEGATIVE_WORDS.some((w) => lower === w || lower.includes(` ${w} `) || lower.startsWith(`${w} `) || lower.endsWith(` ${w}`));

  if (isYes) {
    const label = pendingAction?.type ? (LABEL[pendingAction.type]?.[L] || pendingAction.type) : 'help';
    const reply = {
      en: `Confirmed. A request for ${label} has been sent. A volunteer is coming.`,
      hi: `पुष्टि की गई। ${label} के लिए अनुरोध भेज दिया गया है। स्वयंसेवक आ रहा है।`,
      mr: `निश्चित केले. ${label} साठी विनंती पाठवली आहे. स्वयंसेवक येत आहे.`,
    }[L];

    return {
      confirmed: true,
      cancelled: false,
      reply,
      action: pendingAction,
    };
  }

  if (isNo) {
    const reply = {
      en: 'Understood. Request cancelled. What kind of help do you need?',
      hi: 'समझ गया। अनुरोध रद्द किया गया। आपको किस प्रकार की मदद चाहिए?',
      mr: 'समजले. विनंती रद्द केली. तुम्हाला कोणत्या प्रकारची मदत हवी आहे?',
    }[L];

    return {
      confirmed: false,
      cancelled: true,
      reply,
      action: null,
    };
  }

  return {
    confirmed: false,
    cancelled: false,
    reply: null,
    action: null,
  };
}

/**
 * Main intent classifier:
 * 1. Checks strict safety filter first.
 * 2. Runs LLM classification (with validation & timeout).
 * 3. Falls back to keyword classifier if LLM is unavailable or fails.
 * 4. Re-enforces safety filter on output (guaranteed unbypassable).
 * 5. Handles low-confidence multi-turn confirmation triggers.
 */
export async function classify(rawText = '', options = {}) {
  const text = (rawText || '').trim();
  const language = options.language || 'en';
  const L = ['mr', 'hi', 'en'].includes(language) ? language : 'en';

  if (!text) {
    return {
      intent: 'unknown',
      type: null,
      emergency: false,
      urgency: 1,
      confidence: 0.0,
      priority: 'normal',
      extractedDetails: { who: null, symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
      reply: replyFor({ intent: 'unknown', type: null, emergency: false }, L),
    };
  }

  // 1. Mandatory Safety Check (chest pain, unconscious, bleeding, breathing trouble, suicide)
  const safety = checkSafetyOverride(text, L);
  if (safety.triggered) {
    return {
      intent: safety.intent,
      type: safety.type,
      emergency: true,
      urgency: 5,
      priority: 'critical',
      confidence: 1.0,
      extractedDetails: safety.extractedDetails,
      needsConfirmation: false,
      confirmationPrompt: null,
      reply: safety.reply,
      safetyOverride: true,
      category: safety.category,
    };
  }

  // 2. LLM Classification with keyword fallback
  let result;
  try {
    result = await classifyWithLLM(text, { language: L, ...options });
  } catch (err) {
    result = classifyKeyword(text, options);
  }

  // 3. Post-classification Safety Re-check (defense-in-depth)
  const postSafety = checkSafetyOverride(text, L);
  if (postSafety.triggered || result.emergency === true) {
    result.emergency = true;
    result.urgency = Math.max(result.urgency || 1, 5);
    result.priority = 'critical';
    if (!result.type) result.type = 'medical';
    if (result.intent !== 'request_help') result.intent = 'request_help';
    if (postSafety.triggered) {
      result.reply = postSafety.reply;
      result.safetyOverride = true;
    }
  }

  // 4. Low-confidence multi-turn confirmation
  // Single-word requests or confidence < 0.75 without emergency require confirmation
  if (!result.emergency && result.type && (result.confidence < 0.75 || result.needsConfirmation)) {
    const label = LABEL[result.type]?.[L] || result.type;
    result.needsConfirmation = true;
    result.confirmationPrompt = CONFIRMATION_PROMPTS[L](label);
    result.pendingAction = {
      intent: result.intent,
      type: result.type,
      emergency: false,
      priority: result.priority || 'normal',
    };
    result.reply = result.confirmationPrompt;
  } else {
    result.needsConfirmation = false;
    result.confirmationPrompt = null;
    if (!result.reply) {
      result.reply = replyFor(result, L, options.nearest);
    }
  }

  return result;
}

/**
 * Builds localized response sentence for the user
 */
export function replyFor({ intent, type, emergency, reply: existingReply }, lang = 'en', nearest = null) {
  const L = ['mr', 'hi', 'en'].includes(lang) ? lang : 'en';

  if (intent === 'unknown') {
    return {
      en: 'Sorry, I did not understand. You can say water, food, doctor, toilet, help desk or bus.',
      hi: 'माफ़ कीजिए, मैं समझ नहीं पाया। आप पानी, खाना, डॉक्टर, शौचालय, सहायता केंद्र या बस कह सकते हैं।',
      mr: 'क्षमस्व, मला समजले नाही. तुम्ही पाणी, अन्न, डॉक्टर, स्वच्छतागृह, मदत केंद्र किंवा बस असे म्हणू शकता.',
    }[L];
  }

  if (intent === 'generic_help') {
    return {
      en: 'A volunteer is on the way. What kind of help do you need?',
      hi: 'एक स्वयंसेवक आपके पास आ रहा है। आपको किस प्रकार की मदद चाहिए?',
      mr: 'एक स्वयंसेवक तुमच्याकडे येत आहे. तुम्हाला कोणती मदत हवी आहे?',
    }[L];
  }

  if (intent === 'report_lost_person') {
    return {
      en: 'Lost person report noted. Control room and volunteers are alerted. Please head towards the nearest Help Desk.',
      hi: 'लापता व्यक्ति की सूचना दर्ज की गई। नियंत्रण कक्ष और स्वयंसेवकों को सूचित कर दिया गया है। कृपया निकटतम सहायता केंद्र की ओर बढ़ें।',
      mr: 'व्यक्ती हरवल्याची नोंद झाली आहे. नियंत्रण कक्ष आणि स्वयंसेवकांना कळवले आहे. कृपया सर्वात जवळच्या मदत केंद्राकडे जा.',
    }[L];
  }

  if (intent === 'ask_info') {
    return {
      en: 'For event schedule and darshan timings, please check the main Help Desk near Indrayani Ghat.',
      hi: 'कार्यक्रम और दर्शन समय के लिए, कृपया इंद्रायणी घाट के पास मुख्य सहायता केंद्र पर संपर्क करें।',
      mr: 'कार्यक्रमाची वेळ आणि दर्शन वेळेसाठी कृपया इंद्रायणी घाटाजवळील मुख्य मदत केंद्राशी संपर्क साधा.',
    }[L];
  }

  const label = type && LABEL[type] ? LABEL[type][L] : 'help';

  if (intent === 'find_service' && nearest) {
    const m = nearest.distanceM;
    const placeName = (L === 'mr' && nearest.name_mr) || (L === 'hi' && nearest.name_hi) || nearest.name;
    return {
      en: `The nearest place for ${label} is ${placeName}, about ${m} metres away.`,
      hi: `${label} के लिए सबसे पास ${placeName} है, लगभग ${m} मीटर दूर।`,
      mr: `${label}: सर्वात जवळचे ठिकाण ${placeName} आहे, सुमारे ${m} मीटर अंतरावर.`,
    }[L];
  }

  if (emergency) {
    return SAFETY_REPLIES[L] || SAFETY_REPLIES.en;
  }

  if (existingReply) {
    return existingReply;
  }

  return {
    en: `Okay. I have sent a request for ${label}. A volunteer will reach you soon.`,
    hi: `ठीक है। मैंने ${label} के लिए अनुरोध भेज दिया है। एक स्वयंसेवक जल्द आपके पास पहुँचेगा।`,
    mr: `ठीक आहे. मी ${label} ची विनंती पाठवली आहे. एक स्वयंसेवक लवकरच तुमच्याकडे येईल.`,
  }[L];
}
