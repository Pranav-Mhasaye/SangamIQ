// Attendee-facing strings in English / Hindi / Marathi. Volunteer & organiser dashboards are English for now.
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
};

export const TYPE_LABEL = {
  medical: { en: 'Medical Help', hi: 'चिकित्सा सहायता', mr: 'वैद्यकीय मदत' },
  water: { en: 'Water', hi: 'पानी', mr: 'पाणी' },
  food: { en: 'Food', hi: 'भोजन', mr: 'अन्न' },
  toilet: { en: 'Toilet', hi: 'शौचालय', mr: 'स्वच्छतागृह' },
  helpdesk: { en: 'Help Desk', hi: 'सहायता केंद्र', mr: 'मदत केंद्र' },
  transport: { en: 'Transport', hi: 'परिवहन', mr: 'वाहतूक' },
};

export const makeT = (lang) => {
  const t = (k) => (S[k] ? S[k][lang] || S[k].en : k);
  t.type = (id) => (TYPE_LABEL[id] ? TYPE_LABEL[id][lang] || TYPE_LABEL[id].en : id);
  return t;
};
