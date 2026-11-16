// Pluggable Server Text-to-Speech (TTS) Service for SangamIQ Voice AI.
// Default remains browser speechSynthesis.
// This server provider offers high quality natural neural voices for Marathi, Hindi, and English.

const VOICE_MAPPING = {
  mr: { languageCode: 'mr-IN', name: 'mr-IN-Wavenet-A' },
  hi: { languageCode: 'hi-IN', name: 'hi-IN-Wavenet-A' },
  en: { languageCode: 'en-IN', name: 'en-IN-Wavenet-D' },
};

/**
 * Synthesize speech using Google Cloud Text-to-Speech API
 */
export async function synthesizeSpeech({ text, language = 'mr' }) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  const provider = (process.env.TTS_PROVIDER || '').toLowerCase();

  if (!apiKey || (provider && provider !== 'google')) {
    return {
      available: false,
      useBrowser: true,
      audioBuffer: null,
      mimeType: null,
    };
  }

  const voiceConfig = VOICE_MAPPING[language] || VOICE_MAPPING.mr;
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  const payload = {
    input: { text },
    voice: {
      languageCode: voiceConfig.languageCode,
      name: voiceConfig.name,
      ssmlGender: 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 0.95,
      pitch: 0.0,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return {
      available: false,
      useBrowser: true,
      audioBuffer: null,
      mimeType: null,
    };
  }

  const data = await res.json();
  const audioContent = data.audioContent;
  if (!audioContent) {
    return { available: false, useBrowser: true };
  }

  const buffer = Buffer.from(audioContent, 'base64');
  return {
    available: true,
    useBrowser: false,
    audioBuffer: buffer,
    mimeType: 'audio/mpeg',
  };
}
