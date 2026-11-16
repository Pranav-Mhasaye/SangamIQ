// Pluggable Speech-to-Text (STT) Service for SangamIQ Voice AI.
// Providers: Whisper API (OpenAI / compatible) or Google Cloud Speech-to-Text.
// Supports language hints for Marathi (mr), Hindi (hi), English (en-IN).
// PRIVACY CRITICAL: Never log or persist raw audio buffers or base64 streams.

const LANGUAGE_MAPPING = {
  mr: { whisper: 'mr', google: 'mr-IN' },
  hi: { whisper: 'hi', google: 'hi-IN' },
  en: { whisper: 'en', google: 'en-IN' },
};

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWhisper(audioBuffer, mimeType, language = 'mr') {
  const apiKey = process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('STT: WHISPER_API_KEY or OPENAI_API_KEY is not configured');
  }

  const endpoint = process.env.WHISPER_API_URL || 'https://api.openai.com/v1/audio/transcriptions';
  const langCode = LANGUAGE_MAPPING[language]?.whisper || 'mr';

  // Determine file extension
  let ext = 'webm';
  if (mimeType.includes('wav')) ext = 'wav';
  else if (mimeType.includes('ogg')) ext = 'ogg';
  else if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'm4a';

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append('file', blob, `voice_input.${ext}`);
  formData.append('model', process.env.WHISPER_MODEL || 'whisper-1');
  formData.append('language', langCode);
  formData.append('prompt', 'Alandi Wari pilgrimage crowd safety: medical, water, food, toilet, help desk, lost person, Marathi, Hindi, English.');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Whisper STT error (${res.status}): ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  return {
    text: (data.text || '').trim(),
    provider: 'whisper',
    language: langCode,
  };
}

/**
 * Transcribe using Google Cloud Speech-to-Text v1 REST API
 */
async function transcribeGoogle(audioBuffer, mimeType, language = 'mr') {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('STT: GOOGLE_API_KEY is not configured');
  }

  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;
  const primaryLang = LANGUAGE_MAPPING[language]?.google || 'mr-IN';

  let encoding = 'WEBM_OPUS';
  if (mimeType.includes('wav')) encoding = 'LINEAR16';
  else if (mimeType.includes('ogg')) encoding = 'OGG_OPUS';

  const payload = {
    config: {
      encoding,
      languageCode: primaryLang,
      alternativeLanguageCodes: ['mr-IN', 'hi-IN', 'en-IN'].filter((l) => l !== primaryLang),
      enableAutomaticPunctuation: true,
      model: 'default',
    },
    audio: {
      content: audioBuffer.toString('base64'),
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google STT error (${res.status}): ${errText.slice(0, 100)}`);
  }

  const data = await res.json();
  const transcript = data.results
    ?.map((r) => r.alternatives?.[0]?.transcript)
    .filter(Boolean)
    .join(' ') || '';

  return {
    text: transcript.trim(),
    provider: 'google',
    language: primaryLang,
  };
}

/**
 * Main transcribe entrypoint.
 * NEVER logs raw audio.
 */
export async function transcribeAudio({ audioBuffer, mimeType = 'audio/webm', language = 'mr' }) {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('No audio content provided for transcription');
  }

  const provider = (process.env.STT_PROVIDER || '').toLowerCase();
  const hasWhisperKey = Boolean(process.env.WHISPER_API_KEY || process.env.OPENAI_API_KEY);
  const hasGoogleKey = Boolean(process.env.GOOGLE_API_KEY || process.env.GOOGLE_CLOUD_API_KEY);

  let activeProvider = provider;
  if (!activeProvider) {
    if (hasWhisperKey) activeProvider = 'whisper';
    else if (hasGoogleKey) activeProvider = 'google';
    else activeProvider = 'mock';
  }

  if (activeProvider === 'whisper') {
    return await transcribeWhisper(audioBuffer, mimeType, language);
  }

  if (activeProvider === 'google') {
    return await transcribeGoogle(audioBuffer, mimeType, language);
  }

  // Mock / Console fallback for testing and development
  // Note: never log raw audio content.
  return {
    text: '',
    provider: 'mock',
    language,
    notice: 'No STT provider configured. Browser SpeechRecognition or text input should be used.',
  };
}
