// Voice AI (prototype): keyword intent classifier for English / Hindi / Marathi.
// This is the seam for a real model: replace `classify()` with an LLM / speech-NLU call
// (e.g. Whisper or Google STT for audio -> text, then an LLM for intent) and keep the same return shape.
const LEX = {
  medical: [
    'doctor', 'medical', 'ambulance', 'hurt', 'injur', 'pain', 'sick', 'faint', 'bleed', 'first aid', 'heart', 'medicine', 'dizzy', 'vomit', 'fever',
    'डॉक्टर', 'दवा', 'दर्द', 'बीमार', 'चोट', 'एम्बुलेंस', 'एंबुलेंस', 'तबीयत', 'चक्कर', 'बुखार',
    'औषध', 'दुखत', 'आजारी', 'जखम', 'रुग्णवाहिका', 'त्रास', 'तब्येत', 'ताप', 'उलटी', 'dawakhana', 'aushadh'
  ],
  water: ['water', 'drink', 'thirst', 'पानी', 'प्यास', 'पाणी', 'तहान', 'pani', 'tahan'],
  food: ['food', 'hungry', 'hunger', 'eat', 'meal', 'prasad', 'खाना', 'भूख', 'भोजन', 'भूक', 'जेवण', 'अन्न', 'प्रसाद', 'bhook', 'jevan'],
  toilet: ['toilet', 'washroom', 'restroom', 'bathroom', 'शौचालय', 'टॉयलेट', 'बाथरूम', 'स्वच्छतागृह', 'संडास', 'shauchalay'],
  helpdesk: ['lost', 'missing', 'separated', 'help desk', 'helpdesk', 'information', 'family', 'हरवल', 'बिछड़', 'खो गया', 'खो गई', 'मदत केंद्र', 'सहायता केंद्र', 'माहिती', 'जानकारी', 'कुटुंब', 'परिवार'],
  transport: ['bus', 'shuttle', 'transport', 'taxi', 'ride', 'auto', 'rickshaw', 'बस', 'गाड़ी', 'गाडी', 'वाहन', 'रिक्षा', 'ऑटो', 'शटल'],
};

const EMERGENCY = [
  'emergency', 'urgent', 'unconscious', 'chest pain', 'bleeding', "can't breathe", 'cannot breathe', 'heart attack', 'collapsed',
  'आपातकाल', 'बेहोश', 'छाती', 'खून', 'सांस', 'दिल का दौरा', 'तातडी', 'बेशुद्ध', 'रक्त', 'श्वास', 'हृदय', 'ह्रदय'
];

const GENERIC_HELP = [
  'help', 'need help', 'please help', 'help me',
  'मदद', 'मदद करो', 'सहायता', 'बचाओ',
  'मदत', 'मला मदत हवी आहे', 'वाचवा',
  'madat', 'madad'
];

const WHERE = ['where', 'nearest', 'near', 'find', 'कहाँ', 'कहां', 'कहा है', 'पास', 'कुठे', 'जवळ', 'kuthe', 'kahan'];

const has = (text, words) => words.some((w) => text.includes(w));

export function isCritical(text = '') {
  return has(text.toLowerCase(), EMERGENCY);
}

export function classify(rawText = '') {
  const text = rawText.toLowerCase().trim();
  if (!text) return { intent: 'unknown', type: null, emergency: false };

  const emergency = has(text, EMERGENCY);
  let type = null;
  let best = 0;
  for (const [t, words] of Object.entries(LEX)) {
    const score = words.filter((w) => text.includes(w)).length;
    if (score > best) { best = score; type = t; }
  }

  // If specific emergency like heart attack/unconscious without specific type, map to medical
  if (!type && emergency) {
    return { intent: 'request_help', type: 'medical', emergency: true, priority: 'critical' };
  }

  // If user asked generic distress/help without a specific type
  if (!type && has(text, GENERIC_HELP)) {
    return { intent: 'generic_help', type: 'helpdesk', emergency: false, priority: 'high' };
  }

  if (!type) return { intent: 'unknown', type: null, emergency };

  const intent = !emergency && has(text, WHERE) ? 'find_service' : 'request_help';
  return { intent, type, emergency };
}

const LABEL = {
  medical: { en: 'medical help', hi: 'चिकित्सा सहायता', mr: 'वैद्यकीय मदत' },
  water: { en: 'drinking water', hi: 'पीने का पानी', mr: 'पिण्याचे पाणी' },
  food: { en: 'food', hi: 'भोजन', mr: 'अन्न' },
  toilet: { en: 'a toilet', hi: 'शौचालय', mr: 'स्वच्छतागृह' },
  helpdesk: { en: 'the help desk', hi: 'सहायता केंद्र', mr: 'मदत केंद्र' },
  transport: { en: 'transport', hi: 'परिवहन', mr: 'वाहतूक' },
};

export function replyFor({ intent, type, emergency }, lang = 'en', nearest = null) {
  const L = lang in { en: 1, hi: 1, mr: 1 } ? lang : 'en';
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

  const label = LABEL[type][L];
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
    return {
      en: `Emergency noted. Alerting the nearest volunteers for ${label} now. Stay where you are.`,
      hi: `आपातकाल दर्ज किया गया। ${label} के लिए पास के स्वयंसेवकों को अभी सूचित कर रहे हैं। आप वहीं रुकें।`,
      mr: `तातडीची मदत नोंदवली. ${label} संदर्भात जवळच्या स्वयंसेवकांना आत्ता कळवत आहोत. तुम्ही तिथेच थांबा.`,
    }[L];
  }
  return {
    en: `Okay. I have sent a request for ${label}. A volunteer will reach you soon.`,
    hi: `ठीक है। मैंने ${label} के लिए अनुरोध भेज दिया है। एक स्वयंसेवक जल्द आपके पास पहुँचेगा।`,
    mr: `ठीक आहे. मी ${label} ची विनंती पाठवली आहे. एक स्वयंसेवक लवकरच तुमच्याकडे येईल.`,
  }[L];
}
