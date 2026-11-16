import { useEffect, useRef, useState } from 'react';
import { Mic, X, Volume2, Check, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../ctx';
import { LANGS } from '../i18n';

// Voice AI: speech recognition & server STT -> real voice AI intent classification ->
// request creation & speech synthesis in user's language (Marathi / Hindi / English).
export default function VoiceSheet({ onClose, onRequest }) {
  const { t, lang, pos } = useApp();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const recRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const speechLang = LANGS.find((l) => l.id === lang)?.speech || 'en-IN';

  useEffect(() => () => {
    try {
      recRef.current?.stop();
      mediaRecorderRef.current?.stop();
      window.speechSynthesis?.cancel();
    } catch { /* ignore */ }
  }, []);

  const speak = async (msg) => {
    try {
      // 1. Check for server TTS first
      try {
        const audioUrl = `/api/voice/tts?text=${encodeURIComponent(msg)}&language=${lang}`;
        const check = await fetch(audioUrl, { method: 'HEAD' });
        if (check.ok && check.headers.get('content-type')?.includes('audio')) {
          const audio = new Audio(audioUrl);
          await audio.play();
          return;
        }
      } catch {
        // Fall back to browser TTS
      }

      // 2. Default fallback: browser speechSynthesis
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = speechLang;
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const submit = async (phrase) => {
    if (!phrase.trim()) return;
    setBusy(true); setErr('');

    // If waiting for confirmation and user spoke an answer
    if (pendingConfirmation) {
      const lower = phrase.toLowerCase().trim();
      const isYes = ['yes', 'yeah', 'yep', 'हो', 'होय', 'हाँ', 'हां', 'sahi', 'barobar'].some((w) => lower.includes(w));
      const isNo = ['no', 'nope', 'नाही', 'नहीं', 'गलत', 'chuki'].some((w) => lower.includes(w));

      if (isYes || isNo) {
        return submitConfirmation(isYes);
      }
    }

    try {
      const r = await api('/voice/intent', {
        method: 'POST',
        body: { text: phrase, language: lang, lat: pos.lat, lng: pos.lng },
      });

      if (r.needsConfirmation) {
        setPendingConfirmation(r);
        speak(r.confirmationPrompt || r.reply);
      } else {
        setPendingConfirmation(null);
        setResult(r);
        speak(r.reply);
        if (r.request) onRequest(r.request.id, false);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitConfirmation = async (confirmed) => {
    if (!pendingConfirmation) return;
    setBusy(true); setErr('');
    try {
      const r = await api('/voice/intent', {
        method: 'POST',
        body: {
          confirmed,
          pendingAction: pendingConfirmation.pendingAction,
          language: lang,
          lat: pos.lat,
          lng: pos.lng,
        },
      });
      setResult(r);
      speak(r.reply);
      setPendingConfirmation(null);
      if (r.request) onRequest(r.request.id, false);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Browser SpeechRecognition
  const listenBrowser = () => {
    setErr(''); setResult(null); setPendingConfirmation(null);
    const rec = new SR();
    rec.lang = speechLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      setErr(e.error === 'not-allowed' ? 'Microphone permission is blocked.' : 'Could not hear you. Try again or type.');
    };
    rec.onresult = (e) => {
      const phrase = e.results[0][0].transcript;
      setText(phrase);
      submit(phrase);
    };
    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  };

  // MediaRecorder fallback via /api/voice/transcribe
  const listenMediaRecorder = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Voice input is not supported in this browser. Please type instead.');
      return;
    }

    try {
      setErr(''); setResult(null); setPendingConfirmation(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        setListening(false);
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });

        if (audioBlob.size < 500) return; // Too short/empty

        setBusy(true);
        try {
          // Transcribe via server STT
          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: {
              'Content-Type': audioBlob.type || 'audio/webm',
              'x-language': lang,
            },
            body: audioBlob,
          });

          if (!res.ok) throw new Error('Transcription failed');
          const data = await res.json();
          if (data.text) {
            setText(data.text);
            submit(data.text);
          } else {
            setErr('Could not hear anything clearly. Please try speaking again.');
          }
        } catch (e) {
          setErr(e.message || 'Voice transcription error');
        } finally {
          setBusy(false);
        }
      };

      mediaRecorder.start();
      setListening(true);

      // Auto-stop after 5 seconds of speaking
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5000);
    } catch (e) {
      setListening(false);
      setErr('Microphone access denied or unavailable.');
    }
  };

  const listen = () => {
    if (listening) {
      try {
        recRef.current?.stop();
        mediaRecorderRef.current?.stop();
      } catch { /* ignore */ }
      setListening(false);
      return;
    }

    if (SR) {
      listenBrowser();
    } else {
      listenMediaRecorder();
    }
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={t('speak')}>
      <div className="sheet">
        <button className="icon-btn sheet-x" onClick={onClose} aria-label={t('close')}><X size={22} /></button>
        <h2>{t('speak')}</h2>
        <p className="muted">{listening ? t('listening') : t('tapToSpeak')}</p>
        <button className={`mic ${listening ? 'live' : ''}`} onClick={listen} aria-label={t('speak')}><Mic size={44} /></button>
        <p className="hint">{t('voiceHint')}</p>

        {/* Multi-turn Confirmation for Low-Confidence Results */}
        {pendingConfirmation && (
          <div style={{ marginTop: '14px', padding: '16px', background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '12px' }}>
            <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '14px', textAlign: 'center', color: '#92400E' }}>
              {pendingConfirmation.confirmationPrompt || pendingConfirmation.reply}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => submitConfirmation(true)}
                style={{
                  background: '#16A34A',
                  color: '#fff',
                  padding: '16px 8px',
                  fontSize: '18px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Check size={24} /> {lang === 'mr' ? 'होय (Yes)' : lang === 'hi' ? 'हाँ (Yes)' : 'Yes'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => submitConfirmation(false)}
                style={{
                  background: '#FEE2E2',
                  color: '#DC2626',
                  border: '1px solid #FCA5A5',
                  padding: '16px 8px',
                  fontSize: '18px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                }}
              >
                <X size={24} /> {lang === 'mr' ? 'नाही (No)' : lang === 'hi' ? 'नहीं (No)' : 'No'}
              </button>
            </div>
            <small style={{ display: 'block', textAlign: 'center', marginTop: '10px', color: '#B45309' }}>
              {lang === 'mr' ? 'किंवा माइक दाबून बोला: "हो" / "नाही"' : lang === 'hi' ? 'या माइक दबाकर बोलें: "हाँ" / "नहीं"' : 'Or tap mic and speak: "Yes" / "No"'}
            </small>
          </div>
        )}

        <form className="row" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeInstead')} aria-label={t('typeInstead')} />
          <button className="btn small" disabled={busy}>{t('send')}</button>
        </form>

        {err && <p className="error">{err}</p>}
        {result && (
          <div className="voice-result">
            {result.emergency && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#DC2626', fontWeight: 700, marginBottom: '6px' }}>
                <AlertTriangle size={18} /> Emergency Detected
              </div>
            )}
            <p className="reply"><Volume2 size={18} /> {result.reply}</p>
            {result.request && <button className="btn" onClick={() => onRequest(result.request.id, true)}>{t('trackRequest')}</button>}
            {result.intent === 'find_service' && result.nearest && (
              <a className="btn ghost" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${result.nearest.lat},${result.nearest.lng}&travelmode=walking`}>{t('getDirections')}</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
