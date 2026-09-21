import { useEffect, useRef, useState } from 'react';
import { Icon } from './ui.jsx';
import './tutorial.css';

const SEEN = 'triproam-tutorial-v1';
export const tutorialSteps = [
  { title: 'Your trip starts here', image: 'trips', text: 'Continue with Google, then enter the six-character PIN from your group lead. Starting your own adventure? Tap New trip and give it a name.', target: 'Join with a PIN or create a new trip', box: [4, 28, 92, 27] },
  { title: 'Keep every payment together', image: 'overview', text: 'Overview shows the shared Kitty and your balance. Tap Add expense whenever you pay. Invite friends by sharing the PIN under Travelers · Invite friends.', target: 'Tap Add expense to record a payment', box: [74, 75, 16, 10] },
  { title: 'Choose who shares the cost', image: 'expense', text: 'Use Personal Pocket for money you paid. Enter the amount and description, then choose the people who shared it. Only me keeps an expense private. Check the split before saving.', target: 'Choose everyone who shared this expense', box: [4, 43, 88, 29] },
  { title: 'One Kitty for shared spending', image: 'kitty', text: 'Choose Kitty, then Add my contribution to record money you put into the group fund. Everyone can contribute and view history; only the lead can record Kitty spending.', target: 'Switch to Kitty and choose a contribution', box: [4, 19, 88, 25] },
  { title: 'Know who owes whom', image: 'settlement', text: 'Open Balances for the amounts to pay or receive. Personal Pocket and Group Kitty are separate. Tap Pay / settle to open a payment app, then request receipt confirmation. Balances update after the recipient approves. Check that entries say Synced before settling.', target: 'Check both settlement tabs', box: [4, 23, 88, 9] },
  { title: 'Take TripRoam with you', image: 'install', text: 'Add TripRoam to your home screen for quick access. Open a trip online before going offline; saved payments sync when you reconnect with the app open.', target: 'Follow the steps for your device' },
];

export function InstallationGuide() {
  const [platform, setPlatform] = useState(() => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iphone' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop');
  const options = {
    android: { label: 'Android', title: 'Chrome on Android', steps: ['Open triproam.onrender.com in Chrome.', 'Tap the three-dot menu, then Add to home screen → Install (or Install app).', 'Confirm Install, then open TripRoam from your home screen.'] },
    iphone: { label: 'iPhone / iPad', title: 'Safari on iPhone or iPad', steps: ['Open triproam.onrender.com in Safari.', 'Open Share (sometimes under More), then choose Add to Home Screen.', 'Keep Open as Web App enabled if shown, then tap Add.'] },
    desktop: { label: 'Computer', title: 'Chrome or Edge on a computer', steps: ['Open triproam.onrender.com in Chrome or Edge.', 'Click the install icon in the address bar. You can also look in the browser menu for Install TripRoam.', 'Confirm Install. The app opens in its own window.'] },
  };
  return <section className="install-guide" aria-label="Installation instructions">
    <div className="guide-platforms" role="group" aria-label="Choose your device">{Object.entries(options).map(([key, value]) => <button key={key} type="button" aria-pressed={platform === key} onClick={() => setPlatform(key)}>{value.label}</button>)}</div>
    <h3>{options[platform].title}</h3>
    <img className="install-illustration" src={'/tutorial/install-' + platform + '.svg'} width="520" height="260" alt={platform === 'iphone' ? 'Illustrated Safari Share menu with Add to Home Screen highlighted, then the Add confirmation.' : platform === 'android' ? 'Illustrated Chrome menu with Add to home screen highlighted, then the Install confirmation.' : 'Illustrated desktop browser with its address-bar install icon highlighted, then the Install confirmation.'}/>
    <p className="guide-caption">Browser-menu illustration · wording and position may vary.</p>
    <ol>{options[platform].steps.map(step => <li key={step}>{step}</li>)}</ol>
    <p className="guide-note">Using WhatsApp, Instagram, or another in-app browser? Open this link in your regular browser first. Already installed? Look for TripRoam on your home screen or in your apps.</p>
    <details className="install-location"><summary>Show me where to find installation help</summary><p>After signing in, return to My trips and scroll below your trips.</p><figure className="tutorial-figure"><div className="tutorial-screen"><img src="/tutorial/install.png" width="390" height="720" alt="Demo My trips screen with How to install Triproam below the trip list."/><span className="tutorial-highlight" aria-hidden="true" style={{left:'4%',top:'72%',width:'88%',height:'8%'}}><b>1</b></span></div><figcaption>Installation help on My trips · demo data</figcaption></figure></details>
  </section>;
}

export default function Tutorial() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(SEEN) !== 'seen'; } catch { return true; } });
  const [step, setStep] = useState(0);
  const dialog = useRef(null), heading = useRef(null), body = useRef(null);
  function close() { try { localStorage.setItem(SEEN, 'seen'); } catch { /* Still usable without storage. */ } setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.showModal();
    return () => { dialog.current?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open]);
  useEffect(() => { if (open) { heading.current?.focus(); body.current?.scrollTo(0, 0); } }, [step, open]);
  const current = tutorialSteps[step];
  return <>
    <button className="tutorial-help text-button" onClick={() => { setStep(0); setOpen(true); }}><span aria-hidden="true">?</span>How to use TripRoam</button>
    {open && <dialog ref={dialog} className="tutorial-dialog" aria-labelledby="tutorial-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header className="tutorial-top"><span className="eyebrow">A QUICK TOUR</span><button className="text-button" onClick={close}>Skip tour<Icon name="close" size={16}/></button></header>
      <div className="tutorial-body" ref={body}>
        <p className="tutorial-counter" role="status">Step {step + 1} of {tutorialSteps.length}</p>
        <h2 id="tutorial-title" tabIndex={-1} ref={heading}>{current.title}</h2>
        <p className="tutorial-copy">{current.text}</p>
        {current.image === 'install' ? <InstallationGuide/> : <figure className="tutorial-figure">
          <div className="tutorial-screen"><img src={'/tutorial/' + current.image + '.png'} width="390" height="720" alt={'TripRoam demo screenshot. ' + current.target}/><span className="tutorial-highlight" aria-hidden="true" style={{left:current.box[0]+'%',top:current.box[1]+'%',width:current.box[2]+'%',height:current.box[3]+'%'}}><b>{step+1}</b></span></div>
          <figcaption><strong>{step + 1}. {current.target}</strong><span>Example trip · demo data</span></figcaption>
        </figure>}
      </div>
      <footer className="tutorial-footer"><button className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button><span aria-hidden="true">{tutorialSteps.map((_, i) => <i key={i} className={i===step?'active':''}/>)}</span><button className="primary" onClick={() => step === tutorialSteps.length - 1 ? close() : setStep(step + 1)}>{step === tutorialSteps.length - 1 ? 'Get started' : 'Next'}<Icon name={step === tutorialSteps.length - 1 ? 'check' : 'arrow'} size={18}/></button></footer>
    </dialog>}
  </>;
}
