import { useState } from 'react';
import { ArrowLeft, Phone, Lock, Mail, User, ShieldCheck, HeartHandshake, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth';
import { useApp } from '../ctx';
import { LANGS } from '../i18n';
import { SKILL_LABEL } from '../i18n';

const AVAILABLE_SKILLS = Object.keys(SKILL_LABEL);

export default function LoginScreen({ targetRole, onBack, onComplete }) {
  const { t, lang, setLang } = useApp();
  const { sendOtp, verifyOtp, registerVolunteer, loginOrganiser, enterGuest } = useAuth();

  // Mode for volunteer (signin or register)
  const [volMode, setVolMode] = useState('signin');

  // Phone + OTP state
  const [phone, setPhone] = useState('+91');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [selectedSkills, setSelectedSkills] = useState(['first-aid']);

  // Organiser state
  const [email, setEmail] = useState('admin@sangamiq.local');
  const [password, setPassword] = useState('admin123');

  // Feedback & loading
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleSkill = (sk) => {
    setSelectedSkills((prev) =>
      prev.includes(sk) ? prev.filter((s) => s !== sk) : [...prev, sk]
    );
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 10) {
      setError(t('enterPhone'));
      return;
    }
    setBusy(true);
    try {
      await sendOtp(cleanPhone);
      setOtpSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError(t('otpLabel'));
      return;
    }
    setBusy(true);
    try {
      if (targetRole === 'volunteer' && volMode === 'register') {
        if (!name.trim()) {
          setError(t('fullName') + ' is required');
          setBusy(false);
          return;
        }
        await registerVolunteer(phone.trim(), otp.trim(), name.trim(), selectedSkills);
      } else {
        await verifyOtp(phone.trim(), otp.trim(), targetRole);
      }
      onComplete();
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const handleOrganiserLogin = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await loginOrganiser(email.trim(), password);
      onComplete();
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setBusy(false);
    }
  };

  const handleSkipGuest = () => {
    enterGuest();
    onComplete();
  };

  const title =
    targetRole === 'organiser'
      ? t('loginAsOrganiser')
      : targetRole === 'volunteer'
      ? volMode === 'register'
        ? t('registerTitle')
        : t('loginAsVolunteer')
      : t('loginAsAttendee');

  return (
    <div className={targetRole === 'organiser' ? 'desk' : 'phone'}>
      <header className="topbar back">
        <button className="icon-btn" onClick={onBack} aria-label={t('back')}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </h1>
        <div className="top-actions">
          <select
            className="lang"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            aria-label={t('language')}
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="scroll" style={{ padding: '16px' }}>
        {error && (
          <div className="banner emergency" style={{ marginBottom: '16px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* ORGANISER LOGIN */}
        {targetRole === 'organiser' && (
          <form className="form" onSubmit={handleOrganiserLogin} style={{ maxWidth: '420px', margin: '20px auto' }}>
            <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <ShieldCheck size={40} color="#12305B" style={{ margin: '0 auto 8px' }} />
                <h3>{t('loginAsOrganiser')}</h3>
                <small className="muted">Enter organiser credentials for control room access</small>
              </div>

              <label className="field">
                <span><Mail size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('emailLabel')}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sangamiq.local"
                />
              </label>

              <label className="field">
                <span><Lock size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('passwordLabel')}</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin123"
                />
              </label>

              <p className="tiny muted" style={{ background: 'var(--bg-card)', padding: '8px', borderRadius: '6px' }}>
                Demo credentials: <b>admin@sangamiq.local</b> / <b>admin123</b>
              </p>

              <button className="btn sos" type="submit" disabled={busy}>
                <span className="sos-main">{busy ? t('loading') : t('signIn')}</span>
              </button>
            </div>
          </form>
        )}

        {/* ATTENDEE LOGIN */}
        {targetRole === 'attendee' && (
          <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="banner info">
              <ShieldCheck size={18} />
              <span>{t('guestNotice')}</span>
            </div>

            <button className="btn sos" onClick={handleSkipGuest} style={{ background: '#2E9E5B' }}>
              <span className="sos-main">{t('continueAsGuest')}</span>
            </button>

            <div style={{ textAlign: 'center', position: 'relative', margin: '8px 0' }}>
              <hr style={{ border: 'none', borderTop: '1px solid var(--line)' }} />
              <span style={{ position: 'relative', top: '-12px', background: 'var(--bg)', padding: '0 12px', fontSize: '0.85rem', color: 'var(--muted)' }}>
                {t('signIn')}
              </span>
            </div>

            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="form">
              <label className="field">
                <span><Phone size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('phoneLabel')}</span>
                <input
                  type="tel"
                  required
                  disabled={otpSent}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </label>

              {otpSent && (
                <>
                  <label className="field">
                    <span><Lock size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('otpLabel')}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      autoFocus
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="123456"
                    />
                  </label>
                  <p className="tiny muted">{t('devOtpHint')}</p>
                </>
              )}

              {!otpSent ? (
                <button className="btn sos" type="submit" disabled={busy}>
                  <span className="sos-main">{busy ? t('loading') : t('sendOtp')}</span>
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="btn sos" type="submit" disabled={busy}>
                    <span className="sos-main">{busy ? t('loading') : t('verifyOtp')}</span>
                  </button>
                  <button className="btn ghost small" type="button" onClick={() => setOtpSent(false)}>
                    {t('resendOtp')}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* VOLUNTEER LOGIN & REGISTRATION */}
        {targetRole === 'volunteer' && (
          <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="seg" style={{ marginBottom: '8px' }}>
              <button
                type="button"
                className={volMode === 'signin' ? 'on' : ''}
                onClick={() => { setVolMode('signin'); setOtpSent(false); setError(''); }}
              >
                {t('signIn')}
              </button>
              <button
                type="button"
                className={volMode === 'register' ? 'on' : ''}
                onClick={() => { setVolMode('register'); setOtpSent(false); setError(''); }}
              >
                {t('registerTitle')}
              </button>
            </div>

            {volMode === 'signin' ? (
              <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="form">
                <p className="tiny muted" style={{ marginBottom: '8px' }}>
                  Sign in with the phone number registered with your volunteer profile. (Seeded volunteers: <b>+91900000101</b> to <b>+91900000108</b>)
                </p>

                <label className="field">
                  <span><Phone size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('phoneLabel')}</span>
                  <input
                    type="tel"
                    required
                    disabled={otpSent}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 90000 00101"
                  />
                </label>

                {otpSent && (
                  <>
                    <label className="field">
                      <span><Lock size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('otpLabel')}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                      />
                    </label>
                    <p className="tiny muted">{t('devOtpHint')}</p>
                  </>
                )}

                {!otpSent ? (
                  <button className="btn sos" type="submit" disabled={busy}>
                    <span className="sos-main">{busy ? t('loading') : t('sendOtp')}</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn sos" type="submit" disabled={busy}>
                      <span className="sos-main">{busy ? t('loading') : t('verifyOtp')}</span>
                    </button>
                    <button className="btn ghost small" type="button" onClick={() => setOtpSent(false)}>
                      {t('resendOtp')}
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="form">
                <label className="field">
                  <span><User size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('fullName')}</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kulkarni"
                  />
                </label>

                <label className="field">
                  <span><Phone size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('phoneLabel')}</span>
                  <input
                    type="tel"
                    required
                    disabled={otpSent}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </label>

                <div className="field">
                  <span>{t('selectSkills')}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {AVAILABLE_SKILLS.map((sk) => {
                      const on = selectedSkills.includes(sk);
                      return (
                        <button
                          key={sk}
                          type="button"
                          className={`btn small ${on ? 'sos' : 'ghost'}`}
                          style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                          onClick={() => toggleSkill(sk)}
                        >
                          {on && <Check size={14} style={{ marginRight: '4px' }} />}
                          {t.skill(sk)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {otpSent && (
                  <>
                    <label className="field">
                      <span><Lock size={14} style={{ display: 'inline', marginRight: '4px' }} /> {t('otpLabel')}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        autoFocus
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                      />
                    </label>
                    <p className="tiny muted">{t('devOtpHint')}</p>
                  </>
                )}

                {!otpSent ? (
                  <button className="btn sos" type="submit" disabled={busy || !name.trim()}>
                    <span className="sos-main">{busy ? t('loading') : t('sendOtp')}</span>
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button className="btn sos" type="submit" disabled={busy}>
                      <span className="sos-main">{busy ? t('loading') : t('submitApplication')}</span>
                    </button>
                    <button className="btn ghost small" type="button" onClick={() => setOtpSent(false)}>
                      {t('resendOtp')}
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
