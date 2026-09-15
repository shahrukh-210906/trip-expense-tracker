import { useState } from 'react';
import { api, saveSession } from '../api.js';
import { Icon } from './ui.jsx';

export default function Onboarding({ session, onSession, onJoinSuccess, trips = [] }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(''), [tripName, setTripName] = useState(''), [pin, setPin] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (!session) { const result = await api('/session', { displayName: name }); saveSession(result); onSession(result); }
      const result = await api('/trips/' + mode, mode === 'create' ? { name: tripName } : { joinCode: pin });
      onJoinSuccess(result.trip._id);
    } catch (error) { setError(error.message); } finally { setBusy(false); }
  }
  return <div className="onboarding"><span className="eyebrow">A PLACE FOR EVERY ADVENTURE</span><h1>{mode ? mode === 'join' ? 'Join your friends.' : 'Start a new trip.' : session ? 'Your trips' : 'Let’s get going.'}</h1>
    <p className="intro-copy">{mode ? mode === 'join' ? 'Enter the six-character code shared by your group lead.' : 'Give your trip a name. You’ll get a code to invite everyone.' : trips.length ? 'Pick up where you left off, or plan something new.' : 'Create a trip or join your friends to start tracking expenses.'}</p>
    {!mode ? <>{trips.length > 0 && <div className="trip-grid">{trips.map(trip => <button className="trip-tile" key={trip._id} onClick={() => onJoinSuccess(trip._id)}><span className="trip-tile-top"><span className="trip-mark"><Icon name="trip" size={24}/></span><span className="role-label">{trip.groupLeads.includes(session?.user._id) ? 'Group lead' : 'Traveler'}</span></span><strong>{trip.name}</strong><span className="trip-tile-bottom">Open trip<Icon name="arrow" size={18}/></span></button>)}</div>}
      <div className="trip-actions"><button className="primary" onClick={() => setMode('create')}><Icon name="plus" size={18}/>Create a trip</button><button className="secondary" onClick={() => setMode('join')}><Icon name="users" size={18}/>Join with a code</button></div>
      <div className="getting-started"><Icon name="expenses"/><p><strong>Your money, kept simple.</strong> Record what you paid, see who owes whom, and keep shared funds in a separate group purse.</p></div>
    </> : <section className="onboarding-form"><button disabled={busy} className="text-button" onClick={() => { setMode(null); setError(''); }}><Icon name="back" size={17}/>Back to my trips</button><form onSubmit={submit}><fieldset disabled={busy} className="form-fields">
      {!session && <label>Your name<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Shahrukh" autoComplete="given-name"/></label>}
      {mode === 'create' ? <label>Trip name<input required maxLength={100} value={tripName} onChange={event => setTripName(event.target.value)} placeholder="e.g. Goa with friends"/></label> : <label>Trip code<input className="code-input" required pattern="[A-Za-z0-9]{6}" maxLength={6} value={pin} onChange={event => setPin(event.target.value.toUpperCase())} placeholder="A9B2X7" autoComplete="off"/></label>}
      </fieldset>{error && <p className="error" role="alert">{error}</p>}<button className="primary full" disabled={busy}>{busy ? 'Connecting…' : mode === 'create' ? 'Create trip' : 'Join trip'}<Icon name="arrow" size={18}/></button>
      <small className="session-note">Come back using this browser to access your trips.</small></form></section>}
  </div>;
}
