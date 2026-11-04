import { useEffect, useRef, useState } from 'react';
import { Mic, X, Volume2 } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../ctx';
import { LANGS } from '../i18n';

// Voice AI for people who struggle with touch UIs: speak (or type) -> server detects intent ->
// request is created and the answer is read aloud in the user's language.
export default function VoiceSheet({ onClose, onRequest }) {
  const { t, lang, pos } = useApp();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const recRef = useRef(null);
  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const speechLang = LANGS.find((l) => l.id === lang)?.speech || 'en-IN';

  useEffect(() => () => { try { recRef.current?.stop(); window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  const speak = (msg) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg);
      u.lang = speechLang;
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  };

  const submit = async (phrase) => {
    if (!phrase.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await api('/voice/intent', { method: 'POST', body: { text: phrase, language: lang, lat: pos.lat, lng: pos.lng } });
      setResult(r);
      speak(r.reply);
      if (r.request) onRequest(r.request.id, false);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const listen = () => {
    if (!SR) { setErr('Voice input is not supported in this browser. Please type instead.'); return; }
    setErr(''); setResult(null);
    const rec = new SR();
    rec.lang = speechLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = (e) => { setListening(false); setErr(e.error === 'not-allowed' ? 'Microphone permission is blocked.' : 'Could not hear you. Try again or type.'); };
    rec.onresult = (e) => { const phrase = e.results[0][0].transcript; setText(phrase); submit(phrase); };
    recRef.current = rec;
    try { rec.start(); } catch { /* already started */ }
  };

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label={t('speak')}>
      <div className="sheet">
        <button className="icon-btn sheet-x" onClick={onClose} aria-label={t('close')}><X size={22} /></button>
        <h2>{t('speak')}</h2>
        <p className="muted">{listening ? t('listening') : t('tapToSpeak')}</p>
        <button className={`mic ${listening ? 'live' : ''}`} onClick={listen} aria-label={t('speak')}><Mic size={44} /></button>
        <p className="hint">{t('voiceHint')}</p>

        <form className="row" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('typeInstead')} aria-label={t('typeInstead')} />
          <button className="btn small" disabled={busy}>{t('send')}</button>
        </form>

        {err && <p className="error">{err}</p>}
        {result && (
          <div className="voice-result">
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
