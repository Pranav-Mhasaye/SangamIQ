// Fast rule-based keyword classifier for SangamIQ Voice AI.
// Serves as an instant, zero-network fallback and baseline for testing.

export const LEX = {
  medical: [
    'doctor', 'medical', 'ambulance', 'hurt', 'injur', 'pain', 'sick', 'faint', 'bleed',
    'first aid', 'heart', 'medicine', 'dizzy', 'vomit', 'fever', 'headache', 'stomach',
    'sprain', 'fracture', 'cannot walk',
    'डॉक्टर', 'दवा', 'दर्द', 'बीमार', 'चोट', 'एम्बुलेंस', 'एंबुलेंस', 'तबीयत', 'चक्कर', 'बुखार', 'सिरदर्द', 'पेट दर्द',
    'औषध', 'दुखत', 'आजारी', 'जखम', 'रुग्णवाहिका', 'त्रास', 'तब्येत', 'ताप', 'उलटी', 'डोकं दुखत', 'पोट दुखत',
    'पायाला', 'पाय', 'मुरगळ', 'चालता येत नाही', 'दवाखाना',
    'dawakhana', 'aushadh', 'doke dukhtay', 'beemar', 'dawa', 'dard'
  ],
  water: [
    'water', 'drink', 'thirst', 'thirsty', 'dehydrat',
    'पानी', 'प्यास', 'पीना', 'जल',
    'पाणी', 'तहान', 'प्यायला पाणी',
    'pani', 'tahan', 'paani', 'drinking water'
  ],
  food: [
    'food', 'hungry', 'hunger', 'eat', 'meal', 'prasad', 'lunch', 'dinner', 'breakfast',
    'खाना', 'भूख', 'भोजन', 'प्रसाद', 'रोटी',
    'अन्न', 'भूक', 'जेवण', 'महाप्रसाद', 'अन्नछत्र',
    'bhook', 'jevan', 'khana', 'prasaad'
  ],
  toilet: [
    'toilet', 'washroom', 'restroom', 'bathroom', 'urinal', 'lavatory',
    'शौचालय', 'टॉयलेट', 'बाथरूम', 'मूत्रालय',
    'स्वच्छतागृह', 'संडास', 'शौचालय कुठे',
    'shauchalay', 'toilet kuthe', 'washroom'
  ],
  helpdesk: [
    'lost', 'missing', 'separated', 'help desk', 'helpdesk', 'information', 'family', 'child', 'elderly',
    'खो गया', 'खो गई', 'बिछड़', 'लापता', 'सहायता केंद्र', 'जानकारी', 'परिवार', 'बच्चा',
    'हरवला', 'हरवली', 'सापडत नाही', 'मदत केंद्र', 'माहिती', 'कुटुंब', 'मुलगा', 'मुलगी',
    'haravla', 'haravli', 'kho gaya', 'bachha', 'helpdesk', 'info'
  ],
  transport: [
    'bus', 'shuttle', 'transport', 'taxi', 'ride', 'auto', 'rickshaw', 'railway', 'station',
    'बस', 'गाड़ी', 'गाडी', 'वाहन', 'रिक्षा', 'ऑटो', 'शटल', 'स्टेशन',
    'बस थांबा', 'रिक्षा स्टँड', 'वाहतूक', 'पुणे गाडी', 'कुठून सुटते',
    'rickshaw', 'auto', 'shuttle bus', 'gadi'
  ],
};

export const EMERGENCY_WORDS = [
  'emergency', 'urgent', 'critical', 'danger',
  'आपातकाल', 'तातडी', 'तातडीची', 'गंभीर', 'धोका', 'लगेच'
];

export const GENERIC_HELP = [
  'help', 'need help', 'please help', 'help me', 'assist me',
  'मदद', 'मदद करो', 'सहायता', 'बचाओ', 'मदद चाहिए',
  'मदत', 'मला मदत हवी आहे', 'वाचवा', 'मदत करा', 'मदत हवी',
  'madat', 'madad', 'bachao', 'vachva'
];

export const WHERE_WORDS = [
  'where', 'nearest', 'near', 'find', 'direction', 'route', 'which way',
  'कहाँ', 'कहां', 'कहा है', 'पास', 'किधर', 'रास्ता',
  'कुठे', 'जवळ', 'मार्ग', 'कोणत्या बाजूला', 'कुठून', 'कुठुन', 'सुटते',
  'kuthe', 'kahan', 'kidhar', 'jawal', 'kuthun'
];

export const ASK_INFO_WORDS = [
  'time', 'timing', 'schedule', 'aarti', 'darshan', 'palkhi',
  'समय', 'आरती', 'दर्शन', 'पालकी',
  'वेळ', 'दर्शन वेळ', 'पालखी वेळ', 'आरती कधी आहे',
  'darshan vel', 'palkhi vel', 'aarti'
];

const has = (text, words) => words.some((w) => text.includes(w));

function isLostPersonQuery(text) {
  const lostMarkers = ['lost', 'missing', 'separated', 'हरव', 'खो ग', 'खो गई', 'बिछड़', 'लापता', 'harav', 'kho gaya'];
  const personMarkers = [
    'child', 'mother', 'father', 'son', 'daughter', 'kid', 'brother', 'sister', 'family', 'grandmother', 'grandfather', 'person', 'parent',
    'मुलग', 'मुलगी', 'आई', 'वडील', 'कुटुंब', 'नातू', 'नात',
    'बच्चा', 'लड़की', 'लड़का', 'मां', 'पिता', 'परिवार', 'भाई', 'बहन',
    'aai', 'bhai', 'bachha'
  ];

  return has(text, lostMarkers) && has(text, personMarkers);
}

export function classifyKeyword(rawText = '', options = {}) {
  const text = rawText.toLowerCase().trim();
  if (!text) {
    return {
      intent: 'unknown',
      type: null,
      emergency: false,
      urgency: 1,
      confidence: 0.0,
      extractedDetails: { who: null, symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
    };
  }

  // 1. Specific Lost Person check
  if (isLostPersonQuery(text)) {
    return {
      intent: 'report_lost_person',
      type: 'helpdesk',
      emergency: false,
      urgency: 4,
      priority: 'high',
      confidence: 0.95,
      extractedDetails: { who: 'lost_family_member', symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
    };
  }

  // 2. Specific Info query check
  if (has(text, ASK_INFO_WORDS) && !has(text, ['doctor', 'pain', 'hospital', 'medical'])) {
    return {
      intent: 'ask_info',
      type: 'helpdesk',
      emergency: false,
      urgency: 1,
      priority: 'normal',
      confidence: 0.9,
      extractedDetails: { who: null, symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
    };
  }

  // 3. Score categories
  let type = null;
  let best = 0;
  for (const [t, words] of Object.entries(LEX)) {
    const score = words.filter((w) => text.includes(w)).length;
    if (score > best) {
      best = score;
      type = t;
    }
  }

  const isEmergency = has(text, EMERGENCY_WORDS) && (type === 'medical' || !type || text.includes('emergency') || text.includes('आपातकाल') || text.includes('तातडी'));

  // 4. If no type but emergency
  if (!type && isEmergency) {
    return {
      intent: 'request_help',
      type: 'medical',
      emergency: true,
      urgency: 5,
      priority: 'critical',
      confidence: 0.8,
      extractedDetails: { who: null, symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
    };
  }

  // 5. Generic distress without specific type
  if (!type && has(text, GENERIC_HELP)) {
    return {
      intent: 'generic_help',
      type: 'helpdesk',
      emergency: false,
      urgency: 4,
      priority: 'high',
      confidence: 0.95,
      extractedDetails: { who: null, symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
    };
  }

  // 6. Unknown query
  if (!type) {
    return {
      intent: 'unknown',
      type: null,
      emergency: isEmergency,
      urgency: 1,
      confidence: 0.0,
      extractedDetails: { who: null, symptoms: null, landmark: null },
      needsConfirmation: false,
      confirmationPrompt: null,
    };
  }

  // 7. Check if query is finding a service or requesting help
  const isFind = !isEmergency && has(text, WHERE_WORDS);
  const intent = isFind ? 'find_service' : 'request_help';

  // 8. Low-confidence check (e.g. single noisy word like "water" or "doc")
  const wordCount = text.split(/\s+/).length;
  const isSingleWord = wordCount <= 1;
  const confidence = isSingleWord ? 0.65 : Math.min(0.95, 0.75 + (best * 0.1));

  const needsConfirmation = isSingleWord && !isEmergency && intent === 'request_help';

  return {
    intent,
    type,
    emergency: isEmergency,
    urgency: isEmergency ? 5 : type === 'medical' ? 4 : 2,
    priority: isEmergency ? 'critical' : type === 'medical' ? 'high' : 'normal',
    confidence,
    extractedDetails: { who: null, symptoms: null, landmark: null },
    needsConfirmation,
    confirmationPrompt: needsConfirmation ? `Did you say you need ${type}?` : null,
  };
}
