import { useEffect, useState } from 'react';
import {
  Activity, ArrowDownUp, ArrowRight, ArrowUpRight, BarChart3, BookOpen,
  Clock3, FileJson, Layers3, MoonStar, Repeat2,
  ScanSearch, Search, ShieldCheck, Timer, TrendingUp, UserRoundSearch, Wallet, Waves,
} from 'lucide-react';

const views = [
  { label: 'Overview', route: 'Overview', icon: BarChart3, title: 'See the whole wallet', text: 'Balances, profile decisions, activity, and the records behind them.' },
  { label: 'Balances', route: 'Balances', icon: Wallet, title: 'Read every holding', text: 'Current Ethereum assets with USD values and allocation.' },
  { label: 'Activity', route: 'Activity', icon: Activity, title: 'Map daily activity', text: 'Explore transactions, timing, and the activity heatmap.' },
  { label: 'Token movements', route: 'Token-movements', icon: ArrowDownUp, title: 'Follow token movements', text: 'Filter incoming and outgoing ETH and token transfers.' },
  { label: 'Fund flows', route: 'Fund-flows', icon: Waves, title: 'Trace fund flows', text: 'See incoming and outgoing value by counterparty.' },
  { label: 'Protocols used', route: 'Protocols-used', icon: Layers3, title: 'Spot protocol usage', text: 'Inspect attributed interactions and their transactions.' },
  { label: 'Risk indicators', route: 'Risk-indicators', icon: ShieldCheck, title: 'Check activity signals', text: 'Review six behavioral indicators with their measured values.' },
  { label: 'Profile evidence', route: 'Profile-evidence', icon: BookOpen, title: 'Inspect the evidence', text: 'Read each rule result and its related transactions.' },
];

const profiles = [
  { icon: Activity, title: 'Active trader', detail: '10+ verified DEX trades on 3+ days' },
  { icon: Clock3, title: 'Long-term holder', detail: '80%+ of starting value retained' },
  { icon: Layers3, title: 'DeFi participant', detail: '5+ verified DeFi actions' },
  { icon: Wallet, title: 'Staking participant', detail: 'Verified position, deposit and 14+ days' },
  { icon: MoonStar, title: 'Dormant or new wallet', detail: 'New with little activity, or 90 days inactive' },
];

const riskBands = [
  { name: 'Low', range: 'Score under 30', detail: 'Few or no unusual patterns were detected.', tone: 'low' },
  { name: 'Moderate', range: 'Score 30–59', detail: 'Some behaviour is worth a closer look.', tone: 'moderate' },
  { name: 'High', range: 'Score 60 and above', detail: 'Several unusual patterns were detected at once.', tone: 'high' },
];

const signalCards = [
  { icon: Activity, title: 'Transaction bursts', detail: 'Busiest 10-minute window' },
  { icon: Repeat2, title: 'Repeated patterns', detail: 'One transaction type dominating activity' },
  { icon: Timer, title: 'Timing checks', detail: 'Repeated minute of activity' },
  { icon: Layers3, title: 'DeFi evidence', detail: 'Verified actions in the profile rules' },
  { icon: ShieldCheck, title: 'Verified receipts', detail: 'On-chain transaction status when available' },
  { icon: BarChart3, title: 'Activity score', detail: 'Share of six signals detected' },
  { icon: TrendingUp, title: 'Trade P&L', detail: 'Realized results when reported' },
  { icon: FileJson, title: 'JSON export', detail: 'Download the analysis result' },
  { icon: Clock3, title: 'Balance snapshots', detail: 'Historical records when available' },
  { icon: Layers3, title: 'Protocol interactions', detail: 'Named transactions and their evidence' },
  { icon: Waves, title: 'Counterparty flows', detail: 'Priced incoming and outgoing transfers' },
];

const processSteps = [
  { icon: ScanSearch, title: 'Paste an address', detail: 'Enter any Ethereum wallet address to begin.' },
  { icon: Clock3, title: 'We gather and verify', detail: 'Retrieve balances, transactions, counterparties and available receipt status.' },
  { icon: UserRoundSearch, title: 'Build the behavioral profile', detail: 'Score each assessable profile against the defined rules.' },
  { icon: ShieldCheck, title: 'Read the evidence', detail: 'Inspect matched rules, related transactions and missing inputs.' },
];

function ProcessCube({ phase }: { phase: number }) {
  const cube = (x: number, y: number, z: number, className = '') => {
    const centerX = 180 + (x - y) * 58;
    const centerY = 126 + (x + y) * 30 - z * 66;
    const top = `${centerX},${centerY} ${centerX + 58},${centerY + 30} ${centerX},${centerY + 60} ${centerX - 58},${centerY + 30}`;
    const left = `${centerX - 58},${centerY + 30} ${centerX},${centerY + 60} ${centerX},${centerY + 126} ${centerX - 58},${centerY + 96}`;
    const right = `${centerX + 58},${centerY + 30} ${centerX},${centerY + 60} ${centerX},${centerY + 126} ${centerX + 58},${centerY + 96}`;
    return (
      <g className={`cube-cell ${className}`} key={`${x}-${y}-${z}-${className}`}>
        <polygon className="cube-face cube-face-top" points={top} />
        <polygon className="cube-face cube-face-left" points={left} />
        <polygon className="cube-face cube-face-right" points={right} />
      </g>
    );
  };

  const fixedCubes = [
    [0, 0, 0], [0, 1, 0], [1, 0, 0],
    [0, 0, 1], [0, 1, 1], [1, 0, 1],
  ] as const;

  return (
    <svg className={`process-cube cube-phase-${phase}`} viewBox="0 0 360 390" aria-labelledby="process-cube-title">
      <title id="process-cube-title">Analysis process animation, step {phase + 1} of 4</title>
      <g className="cube-stack">
        {fixedCubes.map(([x, y, z]) => cube(x, y, z))}
        {cube(1, 1, 0, 'cube-cell-bottom-moving')}
        {cube(1, 1, 1, 'cube-cell-top-moving')}
      </g>
    </svg>
  );
}

export default function Landing() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) return;
    const timer = window.setInterval(() => setActiveStep((current) => (current + 1) % processSteps.length), 5000);
    return () => window.clearInterval(timer);
  }, []);
  function openProfile(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      setError('Enter an Ethereum address: 0x followed by 40 hexadecimal characters.');
      return;
    }
    window.location.assign('/profiler/Overview?address=' + encodeURIComponent(value));
  }
  return (
    <div className="landing refreshed-landing">
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <a href="/" className="brand" aria-label="OnChain home">
            <img className="brand-logo" src="/brand-logo.png" alt="" />
            <span>OnChain Wallet Profiler</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#views">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#risk">Risk</a>
            <a href="#profiles">Profiles</a>
            <a className="nav-cta" href="/profiler/Overview">Open profiler <ArrowRight size={15} /></a>
          </nav>
        </div>
      </header>
      <main>
        <section className="landing-wrap landing-hero refreshed-hero">
          <div className="hero-copy">
            <h1>Analyze. Understand. <em>TRUST</em></h1>
            <p>Explore available Ethereum wallet records with behavioral profiles, activity signals, and supporting evidence.</p>
            <form className="home-search" onSubmit={openProfile}>
              <div className="home-search-field">
                <Search size={17} aria-hidden="true" />
                <input
                  aria-label="Ethereum wallet address"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x... paste any Ethereum wallet address"
                  value={address}
                  onChange={(event) => { setAddress(event.target.value); setError(''); }}
                  aria-invalid={!!error}
                />
                <button type="submit">Analyze <ArrowRight size={15} /></button>
              </div>
              {error && <p className="home-error" role="alert">{error}</p>}
            </form>
          </div>
          <div className="hero-showcase" aria-label="Preview of the wallet profiler layout">
            <div className="hero-preview" aria-hidden="true">
              <div className="preview-top"><img src="/brand-logo.png" alt="" /><span>OnChain Wallet Profiler</span><i /></div>
              <div className="preview-tabs"><span>Overview</span><span>Balances</span><span>Activity</span><span>Token movements</span><span>Fund flows</span></div>
              <div className="preview-grid">
                <div className="preview-profile"><span className="preview-donut" /><div><i /><i /><i /></div></div>
                <div className="preview-metrics"><i /><i /><i /><i /></div>
                <div className="preview-chart">{[18, 33, 22, 44, 29, 50, 36, 63, 42, 71, 56, 85, 64, 78, 52, 69].map((n, i) => <span key={i} style={{ height: `${n}%` }} />)}</div>
                <div className="preview-heat">{Array.from({ length: 48 }, (_, i) => <span key={i} className={`heat level-${i % 6}`} />)}</div>
              </div>
            </div>
            <div className="showcase-message">
              <h2>Every Wallet Tells a Story.</h2>
              <p>Read the transactions, inspect the profile rules, and see the evidence behind each decision.<br />Available data and missing inputs stay visible.</p>
            </div>
          </div>
        </section>
        <section className="landing-wrap landing-counts" aria-label="Profiler capabilities">
          <div><strong>8</strong><span>Analysis views</span></div>
          <div><strong>5</strong><span>Behavioral profiles</span></div>
          <div><strong>6</strong><span>Activity signals</span></div>
          <div><strong>Live</strong><span>Ethereum data</span></div>
        </section>
        <section className="landing-wrap landing-views" id="views">
          <div className="section-intro"><span>8 views. One wallet.</span><h2>Everything a wallet<br />did, in one place.</h2><p>Open any view and follow the records behind the result.</p></div>
          <div className="view-grid">
            {views.map(({ label, route, icon: Icon, title, text }) => (
              <a className="view-card" key={route} href={`/profiler/${route}`}>
                <div className="view-card-top"><Icon size={21} /><ArrowUpRight size={15} /></div>
                <small>/{label.toLowerCase().replaceAll(' ', '-')}</small>
                <h3>{title}</h3><p>{text}</p>
              </a>
            ))}
          </div>
        </section>
        <section className="landing-wrap landing-signals" id="signals">
          <div className="section-intro"><span>And much more</span><h2>Every signal, measured.</h2><p>Checks, scores and data points are shown when the supporting records are available.</p></div>
          <div className="landing-signal-rows">
            {[signalCards.slice(0, 4), signalCards.slice(4, 7), signalCards.slice(7)].map((row, index) => (
              <div className={`landing-signal-row landing-signal-row-${index + 1}`} key={index}>
                {row.map(({ icon: Icon, title, detail }) => (
                  <article className="landing-signal-card" key={title}>
                    <span className="landing-signal-icon"><Icon size={25} strokeWidth={1.8} aria-hidden="true" /></span>
                    <div><h3>{title}</h3><p>{detail}</p></div>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>
        <section className="landing-wrap landing-steps" id="how-it-works">
          <div className="steps-copy">
            <div><span className="eyebrow">How it works</span><h2>From address to<br />evidence.</h2><p>Available records are gathered, checked and scored before the result is shown.</p></div>
            <ProcessCube phase={activeStep} />
          </div>
          <ol aria-label="Wallet analysis process">
            {processSteps.map(({ icon: Icon, title, detail }, index) => <li className={activeStep === index ? 'is-active' : ''} aria-current={activeStep === index ? 'step' : undefined} key={title}><span className="step-icon"><Icon size={24} strokeWidth={1.8} /></span><div><span className="step-number">Step 0{index + 1}</span><h3>{title}</h3><p>{detail}</p></div></li>)}
          </ol>
        </section>
        <section className="landing-wrap landing-profiles" id="profiles">
          <div className="section-intro"><span>Behavioral profiles</span><h2>Five profiles. Defined rules.</h2><p>A profile is assigned only when its inputs can be verified. Missing inputs stay visible.</p></div>
          <div className="profile-card-grid">
            {profiles.map(({ icon: Icon, title, detail }) => <article key={title}><span className="profile-card-icon"><Icon size={28} strokeWidth={1.7} /></span><div><h3>{title}</h3><p>{detail}</p></div></article>)}
          </div>
        </section>
        <section className="landing-wrap landing-risk" id="risk">
          <div className="section-intro"><span>Activity indicators</span><h2>An activity band, not a verdict.</h2><p>The score is the share of six behavioral signals detected. It is not a fraud, sanction, credit, or investment-risk rating.</p></div>
          <div className="risk-band-grid">
            {riskBands.map((band) => <article className={`risk-band-card risk-band-card-${band.tone}`} key={band.name}><div className="risk-band-head"><i /><span>{band.range}</span></div><h3>{band.name}</h3><p>{band.detail}</p></article>)}
          </div>
        </section>
      </main>
      <footer className="landing-wrap landing-footer"><span>OnChain Wallet Profiler</span><span>Ethereum wallet analytics</span><span>© {new Date().getFullYear()}</span></footer>
    </div>
  );
}
