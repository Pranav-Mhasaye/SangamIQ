// Critical safety overrides for SangamIQ Voice AI.
// Any mention of chest pain, unconsciousness, heavy bleeding, breathing trouble,
// or suicide-related words MUST trigger emergency=true, urgency=5, priority='critical',
// type='medical', and a safety reply instructing the user to stay calm and stay put.
// Medical advice beyond "stay calm, sit down, help is coming" is strictly prohibited.

export const SAFETY_TERMS = {
  chest_pain: [
    'chest pain', 'chest hurts', 'chest ache', 'pain in chest', 'heart attack',
    'heart pain', 'heart is aching', 'cardiac',
    'छातीत दुखत', 'छातीत दुखतं', 'छाती दुखते', 'छातीत कळ', 'हार्ट अटॅक', 'हृदयविकार', 'हार्ट अटैक',
    'सीने में दर्द', 'छाती में दर्द', 'दिल में दर्द', 'दिल का दौरा', 'हार्ट में पेन',
    'chati dukhte', 'chatit dukhtay', 'chati madhe dukhatahe', 'seene me dard', 'seene mein dard', 'dil me dard'
  ],
  unconscious: [
    'unconscious', 'fainted', 'passed out', 'blacked out', 'collapsed', 'unresponsive',
    'not waking up', 'lost consciousness',
    'बेशुद्ध', 'चक्कर येऊन पडले', 'शुद्ध हरपली', 'जागे होत नाहीत', 'पडले आहेत',
    'बेहोश', 'बेहोश हो गया', 'बेहोश हो गई', 'चक्कर खाकर गिर', 'होश नहीं है',
    'beshuddha', 'behosh', 'chakkar yeun padle', 'behosh ho gaya'
  ],
  heavy_bleeding: [
    'heavy bleeding', 'bleeding heavily', 'profuse bleeding', 'lots of blood', 'severe bleeding',
    'blood gushing', 'bleeding a lot', 'blood loss',
    'रक्तस्त्राव', 'खूप रक्त', 'रक्त वाहत आहे', 'रक्तस्त्राव होतोय', 'रक्त थांबत नाही',
    'खून बह रहा है', 'बहुत खून', 'गंभीर रक्तस्राव', 'खून नहीं रुक रहा',
    'rakta vahate', 'khup rakta', 'khoon beh raha hai', 'bahut khoon'
  ],
  breathing_trouble: [
    'breathing trouble', "can't breathe", 'cannot breathe', 'shortness of breath',
    'hard to breathe', 'choking', 'suffocating', 'gasping for air',
    'श्वास घेण्यास त्रास', 'श्वास गुदमरतोय', 'श्वास लागतोय', 'दम लागतोय', 'श्वास थांबला', 'श्वास',
    'सांस लेने में तकलीफ', 'सांस नहीं आ रही', 'दम घुट रहा है', 'सांस फूल रही है',
    'shwas ghyayla tras', 'dam lagtoy', 'saans lene me takleef', 'saans nahi aa rahi'
  ],
  suicide: [
    'suicide', 'kill myself', 'end my life', 'want to die', 'end it all', 'take my life',
    'आत्महत्या', 'स्वतःला संपवणे', 'जीव द्यायचा आहे', 'जीव संपवतो', 'जगायचं नाही',
    'आत्महत्या', 'खुदकुशी', 'जान देनी है', 'मरना चाहता हूँ', 'मरना चाहती हूँ',
    'maraycha ahe', 'jeev dyaycha', 'khudkushi', 'jaan dena'
  ]
};

export const SAFETY_REPLIES = {
  en: 'Emergency noted. Please stay calm, sit down, and stay where you are. Volunteers and medical help are being alerted right now.',
  hi: 'आपातकाल दर्ज किया गया। कृपया शांत रहें, बैठ जाएं और वहीं रुकें। पास के स्वयंसेवकों और चिकित्सा सहायता को तुरंत सूचित किया जा रहा है।',
  mr: 'तातडीची मदत नोंदवली आहे. कृपया शांत राहा, खाली बसा आणि तिथेच थांबा. जवळचे स्वयंसेवक आणि वैद्यकीय मदत लगेच पाठवली जात आहे.',
};

/**
 * Checks raw input text for life-safety keywords.
 * Returns { triggered: true, ... } if any critical keyword is present.
 */
export function checkSafetyOverride(rawText = '', language = 'en') {
  const text = rawText.toLowerCase().trim();
  if (!text) return { triggered: false };

  const lang = ['mr', 'hi', 'en'].includes(language) ? language : 'en';

  // 1. Direct phrase matching
  for (const [category, terms] of Object.entries(SAFETY_TERMS)) {
    const matchedTerm = terms.find((t) => text.includes(t));
    if (matchedTerm) {
      return buildSafetyResult(category, matchedTerm, lang);
    }
  }

  // 2. Semantic combination checks
  // Breathing trouble combination (e.g. "गर्दीत मला श्वास घेण्यास खूप त्रास होतोय")
  if (
    (text.includes('श्वास') && (text.includes('त्रास') || text.includes('गुदमर') || text.includes('थांब') || text.includes('लागत') || text.includes('कठीण'))) ||
    (text.includes('सांस') && (text.includes('तकलीफ') || text.includes('नहीं') || text.includes('घुट') || text.includes('फूल') || text.includes('दिक्कत'))) ||
    (text.includes('breath') && (text.includes('trouble') || text.includes('short') || text.includes('hard') || text.includes("can't") || text.includes('cannot') || text.includes('gasp') || text.includes('chok'))) ||
    (text.includes('shwas') && (text.includes('tras') || text.includes('lagtoy'))) ||
    (text.includes('saans') && (text.includes('takleef') || text.includes('nahi') || text.includes('fool')))
  ) {
    return buildSafetyResult('breathing_trouble', 'breathing_combination', lang);
  }

  // Chest pain combination (e.g. "chest me bahut dard")
  if (
    (text.includes('chest') || text.includes('सीने') || text.includes('छाती') || text.includes('chatit') || text.includes('seene')) &&
    (text.includes('pain') || text.includes('दर्द') || text.includes('दुख') || text.includes('dukhtay') || text.includes('dard'))
  ) {
    return buildSafetyResult('chest_pain', 'chest_pain_combination', lang);
  }

  // Unconscious combination (e.g. "chakkar aake gir gaya behosh")
  if (
    (text.includes('चक्कर') || text.includes('chakkar')) &&
    (text.includes('पडले') || text.includes('padle') || text.includes('गिर') || text.includes('gir'))
  ) {
    return buildSafetyResult('unconscious', 'collapse_combination', lang);
  }

  return { triggered: false };
}

function buildSafetyResult(category, matchedTerm, lang) {
  return {
    triggered: true,
    category,
    matchedTerm,
    intent: 'request_help',
    type: 'medical',
    emergency: true,
    urgency: 5,
    priority: 'critical',
    confidence: 1.0,
    needsConfirmation: false,
    extractedDetails: {
      who: 'attendee_or_companion',
      symptoms: category.replace('_', ' '),
      landmark: null,
    },
    reply: SAFETY_REPLIES[lang] || SAFETY_REPLIES.en,
  };
}
