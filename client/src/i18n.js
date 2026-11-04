// Attendee & Volunteer strings in English / Hindi / Marathi.
export const LANGS = [
  { id: 'mr', label: 'मराठी', speech: 'mr-IN' },
  { id: 'hi', label: 'हिंदी', speech: 'hi-IN' },
  { id: 'en', label: 'English', speech: 'en-IN' },
];

const S = {
  tagline: { en: 'Together for safer gatherings', hi: 'सुरक्षित समारोह के लिए साथ', mr: 'सुरक्षित सोहळ्यासाठी एकत्र' },
  requestHelp: { en: 'Request Help', hi: 'मदद मांगें', mr: 'मदत मागा' },
  tapEmergency: { en: 'Tap for emergency assistance', hi: 'आपातकालीन सहायता के लिए दबाएं', mr: 'तातडीच्या मदतीसाठी दाबा' },
  selectType: { en: 'Select the type of help you need', hi: 'आपको किस प्रकार की मदद चाहिए, चुनें', mr: 'तुम्हाला कोणती मदत हवी ते निवडा' },
  sendRequest: { en: 'Send Request', hi: 'अनुरोध भेजें', mr: 'विनंती पाठवा' },
  locationShared: { en: 'Your location will be shared with nearby volunteers and help providers.', hi: 'आपकी लोकेशन पास के स्वयंसेवकों और सहायता प्रदाताओं के साथ साझा की जाएगी।', mr: 'तुमचे स्थान जवळच्या स्वयंसेवकांना आणि मदत पुरवठादारांना कळवले जाईल.' },
  emergency: { en: 'Emergency', hi: 'आपातकाल', mr: 'तातडीची मदत' },
  emergencySub: { en: 'For urgent medical or safety assistance', hi: 'तत्काल चिकित्सा या सुरक्षा सहायता के लिए', mr: 'तातडीच्या वैद्यकीय किंवा सुरक्षा मदतीसाठी' },
  noteLabel: { en: 'Anything we should know? (optional)', hi: 'कुछ बताना है? (वैकल्पिक)', mr: 'काही सांगायचे आहे? (ऐच्छिक)' },
  home: { en: 'Home', hi: 'होम', mr: 'मुख्यपृष्ठ' },
  map: { en: 'Map', hi: 'नक्शा', mr: 'नकाशा' },
  alerts: { en: 'Alerts', hi: 'अलर्ट', mr: 'सूचना' },
  profile: { en: 'Profile', hi: 'प्रोफाइल', mr: 'प्रोफाइल' },
  nearby: { en: 'Nearest help', hi: 'सबसे पास की मदद', mr: 'सर्वात जवळची मदत' },
  getDirections: { en: 'Get Directions', hi: 'रास्ता देखें', mr: 'मार्ग पहा' },
  callVolunteer: { en: 'Call Volunteer', hi: 'स्वयंसेवक को कॉल करें', mr: 'स्वयंसेवकाला कॉल करा' },
  requestHere: { en: 'Request help for this', hi: 'इसके लिए मदद मांगें', mr: 'यासाठी मदत मागा' },
  speak: { en: 'Speak', hi: 'बोलें', mr: 'बोला' },
  listening: { en: 'Listening…', hi: 'सुन रहा हूँ…', mr: 'ऐकत आहे…' },
  tapToSpeak: { en: 'Tap the mic and speak', hi: 'माइक दबाकर बोलें', mr: 'माइक दाबा आणि बोला' },
  voiceHint: { en: 'Say: “I need water” or “doctor”', hi: 'कहें: “पानी चाहिए” या “डॉक्टर”', mr: 'बोला: “पाणी हवे आहे” किंवा “डॉक्टर”' },
  typeInstead: { en: 'Or type here', hi: 'या यहाँ लिखें', mr: 'किंवा इथे लिहा' },
  send: { en: 'Send', hi: 'भेजें', mr: 'पाठवा' },
  trackRequest: { en: 'Track my request', hi: 'मेरा अनुरोध देखें', mr: 'माझी विनंती पहा' },
  yourRequest: { en: 'Your request', hi: 'आपका अनुरोध', mr: 'तुमची विनंती' },
  gotHelp: { en: 'I got help', hi: 'मुझे मदद मिल गई', mr: 'मला मदत मिळाली' },
  cancel: { en: 'Cancel request', hi: 'अनुरोध रद्द करें', mr: 'विनंती रद्द करा' },
  close: { en: 'Close', hi: 'बंद करें', mr: 'बंद करा' },
  back: { en: 'Back', hi: 'वापस', mr: 'मागे' },
  st_open: { en: 'Request sent - finding volunteers', hi: 'अनुरोध भेजा गया - स्वयंसेवक खोज रहे हैं', mr: 'विनंती पाठवली - स्वयंसेवक शोधत आहोत' },
  st_accepted: { en: 'A volunteer is on the way', hi: 'एक स्वयंसेवक आ रहा है', mr: 'एक स्वयंसेवक येत आहे' },
  st_completed: { en: 'Help received', hi: 'मदद मिल गई', mr: 'मदत मिळाली' },
  st_cancelled: { en: 'Request cancelled', hi: 'अनुरोध रद्द किया गया', mr: 'विनंती रद्द केली' },
  alertedVolunteers: { en: 'Volunteers alerted nearby', hi: 'पास के स्वयंसेवकों को सूचित किया', mr: 'जवळच्या स्वयंसेवकांना कळवले' },
  minAway: { en: 'min away', hi: 'मिनट दूर', mr: 'मिनिटे दूर' },
  noAlerts: { en: 'No alerts right now.', hi: 'अभी कोई अलर्ट नहीं है।', mr: 'सध्या कोणतीही सूचना नाही.' },
  language: { en: 'Language', hi: 'भाषा', mr: 'भाषा' },
  yourName: { en: 'Your name', hi: 'आपका नाम', mr: 'तुमचे नाव' },
  emergencyContact: { en: 'Emergency contact number', hi: 'आपातकालीन संपर्क नंबर', mr: 'आणीबाणी संपर्क क्रमांक' },
  largeText: { en: 'Large text', hi: 'बड़े अक्षर', mr: 'मोठे अक्षर' },
  useGps: { en: 'Use my real GPS location', hi: 'मेरी असली GPS लोकेशन इस्तेमाल करें', mr: 'माझे खरे GPS स्थान वापरा' },
  demoLocation: { en: 'Demo location: Alandi, Pune', hi: 'डेमो लोकेशन: आलंदी, पुणे', mr: 'डेमो स्थान: आळंदी, पुणे' },
  yourLocation: { en: 'Your location', hi: 'आपकी लोकेशन', mr: 'तुमचे स्थान' },
  verified: { en: 'Verified', hi: 'सत्यापित', mr: 'पडताळलेले' },
  openHours: { en: 'Timings', hi: 'समय', mr: 'वेळ' },
  available: { en: 'Available services', hi: 'उपलब्ध सेवाएं', mr: 'उपलब्ध सेवा' },
  runBy: { en: 'Run by', hi: 'संचालक', mr: 'संचालक' },
  allTypes: { en: 'All', hi: 'सभी', mr: 'सर्व' },
  changeRole: { en: 'Change role', hi: 'रोल बदलें', mr: 'भूमिका बदला' },
  confirmChangeRole: { en: 'Are you sure you want to switch role?', hi: 'क्या आप निश्चित रूप से रोल बदलना चाहते हैं?', mr: 'तुम्हाला खात्री आहे की तुम्ही भूमिका बदलू इच्छिता?' },

  // Volunteer dashboard strings
  volDashboard: { en: 'Volunteer Dashboard', hi: 'स्वयंसेवक डैशबोर्ड', mr: 'स्वयंसेवक डॅशबोर्ड' },
  volOnline: { en: 'You are online - receiving requests', hi: 'आप ऑनलाइन हैं - अनुरोध प्राप्त हो रहे हैं', mr: 'तुम्ही ऑनलाइन आहात - विनंत्या येत आहेत' },
  volOffline: { en: 'You are offline - tap to go online', hi: 'आप ऑफलाइन हैं - ऑनलाइन होने के लिए दबाएं', mr: 'तुम्ही ऑफलाइन आहात - ऑनलाइन होण्यासाठी दाबा' },
  openRequests: { en: 'Open requests', hi: 'खुले अनुरोध', mr: 'प्रलंबित विनंत्या' },
  inProgressYou: { en: 'In progress (you)', hi: 'प्रगति पर (आप)', mr: 'प्रगतीपथावर (तुम्ही)' },
  completedYou: { en: 'Completed (you)', hi: 'पूर्ण (आप)', mr: 'पूर्ण केले (तुम्ही)' },
  yourActiveTasks: { en: 'Your active tasks', hi: 'आपके सक्रिय कार्य', mr: 'तुमची सक्रिय कामे' },
  incomingRequests: { en: 'Incoming requests', hi: 'आने वाले अनुरोध', mr: 'नवीन विनंत्या' },
  goOnlineHint: { en: 'Go online to accept requests.', hi: 'अनुरोध स्वीकार करने के लिए ऑनलाइन जाएं।', mr: 'विनंत्या स्वीकारण्यासाठी ऑनलाइन जा.' },
  noOpenRequests: { en: 'No open requests right now. New ones appear here instantly.', hi: 'अभी कोई खुला अनुरोध नहीं है। नए अनुरोध तुरंत यहाँ दिखाई देंगे।', mr: 'सध्या कोणतीही प्रलंबित विनंती नाही. नवीन विनंत्या लगेच इथे दिसतील.' },
  matchedToYou: { en: 'Matched to you', hi: 'आपके लिए उपयुक्त', mr: 'तुमच्यासाठी जुळणारे' },
  viaVoice: { en: 'via voice', hi: 'आवाज़ द्वारा', mr: 'व्हॉइस द्वारे' },
  done: { en: 'Done', hi: 'पूर्ण', mr: 'पूर्ण झाले' },
  accept: { en: 'Accept', hi: 'स्वीकारें', mr: 'स्वीकारा' },
  reqAccepted: { en: 'Request accepted', hi: 'अनुरोध स्वीकार किया गया', mr: 'विनंती स्वीकारली' },
  markedDone: { en: 'Marked as done', hi: 'पूर्ण चिह्नित किया गया', mr: 'पूर्ण म्हणून नोंदवले' },
  switchRole: { en: 'Switch role', hi: 'रोल बदलें', mr: 'भूमिका बदला' },
  loading: { en: 'Loading…', hi: 'लोड हो रहा है…', mr: 'लोड होत आहे…' },
};

export const TYPE_LABEL = {
  medical: { en: 'Medical Help', hi: 'चिकित्सा सहायता', mr: 'वैद्यकीय मदत' },
  water: { en: 'Water', hi: 'पानी', mr: 'पाणी' },
  food: { en: 'Food', hi: 'भोजन', mr: 'अन्न' },
  toilet: { en: 'Toilet', hi: 'शौचालय', mr: 'स्वच्छतागृह' },
  helpdesk: { en: 'Help Desk', hi: 'सहायता केंद्र', mr: 'मदत केंद्र' },
  transport: { en: 'Transport', hi: 'परिवहन', mr: 'वाहतूक' },
};

export const SKILL_LABEL = {
  'first-aid': { en: 'First Aid', hi: 'प्राथमिक उपचार', mr: 'प्रथमोपचार' },
  'elderly-care': { en: 'Elderly Care', hi: 'बुजुर्ग सेवा', mr: 'ज्येष्ठ नागरिक सेवा' },
  medical: { en: 'Medical Support', hi: 'चिकित्सा सहायता', mr: 'वैद्यकीय मदत' },
  water: { en: 'Water Supply', hi: 'जल सेवा', mr: 'पाणी पुरवठा' },
  food: { en: 'Food Supply', hi: 'भोजन सेवा', mr: 'अन्नदान सेवा' },
  toilet: { en: 'Sanitation', hi: 'स्वच्छता', mr: 'स्वच्छता' },
  helpdesk: { en: 'Help Desk & Info', hi: 'सहायता केंद्र', mr: 'मदत केंद्र' },
  transport: { en: 'Transport', hi: 'परिवहन', mr: 'वाहतूक' },
};

export const makeT = (lang) => {
  const t = (k) => (S[k] ? S[k][lang] || S[k].en : k);
  t.type = (id) => (TYPE_LABEL[id] ? TYPE_LABEL[id][lang] || TYPE_LABEL[id].en : id);
  t.skill = (id) => (SKILL_LABEL[id] ? SKILL_LABEL[id][lang] || SKILL_LABEL[id].en : id);
  return t;
};
