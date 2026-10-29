import React, { useCallback, useEffect, useState } from 'react';
import './LaunchScreen.css';

// This component stays mounted outside Routes: navigation never replays the intro.
export default function LaunchScreen() {
  const [open, setOpen] = useState(true);
  const [run, setRun] = useState(0);
  const dismiss = useCallback(() => setOpen(false), []);
  useEffect(() => {
    const replay = () => { setRun(value => value + 1); setOpen(true); };
    window.addEventListener('demstav-intro', replay);
    return () => window.removeEventListener('demstav-intro', replay);
  }, []);
  useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(dismiss, reduced ? 300 : 3500);
    const escape = event => { if (event.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', escape);
    return () => { window.clearTimeout(timer); window.removeEventListener('keydown', escape); };
  }, [open, run, dismiss]);
  if (!open) return null;
  return (
    <div key={run} className="demstav-launch" role="dialog" aria-modal="true" aria-label="Spouštění DEMSTAV Operations">
      <div className="demstav-launch-scene" aria-hidden="true">
        <div className="demstav-launch-stage">
          <div className="demstav-launch-photo" style={{ backgroundImage: `url(${process.env.PUBLIC_URL || ""}/images/demstav-launch.webp)` }} />
          <span className="demstav-launch-beacon" />
        </div>
      </div>
      <div className="demstav-launch-shade" aria-hidden="true" />
      <div className="demstav-launch-brand">
        <svg viewBox="0 0 220 88" aria-hidden="true"><path d="M8 78 49 39 67 51 110 7 160 65 174 48 209 79 181 79 174 72 161 86 109 35 69 77 49 67 37 79Z" fill="currentColor" /></svg>
        <strong>DEMSTAV</strong><span>OPERATIONS</span>
        <p>STROJE <b>•</b> LIDÉ <b>•</b> VÝSLEDKY</p>
      </div>
      <div className="demstav-launch-progress" aria-hidden="true"><span /></div>
      <button className="demstav-launch-skip" autoFocus onClick={dismiss}>Přeskočit →</button>
    </div>
  );
}
