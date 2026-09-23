import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Search,
  Activity,
  Layers,
  Clock3,
  IdCard,
  Images,
  Coins,
  FileDown,
  MoonStar,
} from 'lucide-react';

export default function Landing() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  function openProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      setError(
        'Enter an Ethereum address: 0x followed by 40 hexadecimal characters.',
      );
      return;
    }
    window.location.assign('/profiler?address=' + encodeURIComponent(value));
  }
  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-wrap landing-nav">
          <a href="/" className="brand" aria-label="OnChain home">
            <Blocks size={25} />
            <span>OnChain</span>
          </a>
          <nav aria-label="Main navigation">
            <a href="#profiles">Wallet profiles</a>
            <a href="#how-it-works">How it works</a>
            <a className="nav-cta" href="/profiler">
              Open profiler <ArrowUpRight size={15} />
            </a>
          </nav>
        </div>
      </header>
      <main>
        <section className="landing-wrap landing-hero">
          <div className="hero-copy">
            <span className="home-eyebrow">
              <span /> Ethereum wallet analytics
            </span>
            <h1>
              Understand a wallet’s <em>behavior.</em>
            </h1>
            <p>
              Look beyond the transaction list. Explore how a wallet trades, the
              protocols it uses, and the activity behind its behavioral profile.
            </p>
            <form className="home-search" onSubmit={openProfile}>
              <label htmlFor="home-wallet">Start with a wallet address</label>
              <div className="home-search-field">
                <Search size={18} />
                <input
                  id="home-wallet"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Enter an Ethereum address (0x…)"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setError('');
                  }}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'home-error' : 'home-search-note'}
                />
                <button aria-label="Analyze wallet" type="submit">
                  <ArrowRight size={20} />
                </button>
              </div>
              {error ? (
                <p className="home-error" id="home-error" role="alert">
                  {error}
                </p>
              ) : (
                <p id="home-search-note">
                  No wallet connection or sign-in required.
                </p>
              )}
            </form>
            <a className="home-inline-link" href="/profiler">
              Explore the profiler <ArrowRight size={16} />
            </a>
          </div>
          <figure className="profile-map" aria-labelledby="profile-map-caption">
            <figcaption id="profile-map-caption">
              From onchain activity to insight
            </figcaption>
            <ul className="profile-map-signals">
              {[
                {
                  icon: Activity,
                  title: 'Transaction activity',
                  detail: 'Frequency, volume and active days',
                },
                {
                  icon: Layers,
                  title: 'Protocols used',
                  detail: 'Trading, lending and staking interactions',
                },
                {
                  icon: Clock3,
                  title: 'Timing patterns',
                  detail: 'Consistency, bursts and changes over time',
                },
              ].map(({ icon: Icon, title, detail }) => (
                <li key={title}>
                  <span className="profile-map-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="profile-map-result">
              <span className="profile-map-mark">
                <IdCard size={28} aria-hidden="true" />
              </span>
              <div>
                <h2>A behavioral profile</h2>
                <p>Patterns connected. Evidence explained.</p>
              </div>
            </div>
            <a className="profile-map-link" href="#how-it-works">
              See how it works <ArrowRight size={15} aria-hidden="true" />
            </a>
          </figure>
        </section>
        <section className="home-capabilities" aria-label="Analysis features">
          <div className="landing-wrap">
            <span>Behavioral profiles</span>
            <span>Activity history</span>
            <span>Protocol interactions</span>
            <span>Explainable indicators</span>
          </div>
        </section>
        <section className="landing-wrap home-profiles" id="profiles">
          <div className="home-section-heading">
            <div>
              <span className="section-number">01 / Wallet profiles</span>
              <h2>
                Different activity.
                <br />
                Different profiles.
              </h2>
            </div>
            <p>
              A balance tells you what a wallet holds. A behavioral profile
              helps you understand how it participates.
            </p>
          </div>
          <div className="profile-types">
            {[
              {
                icon: Activity,
                title: 'Active trader',
                text: 'Verified DEX swaps across multiple days, with a meaningful share of outgoing transactions.',
                detail: 'DEX swaps · Trading days',
              },
              {
                icon: Layers,
                title: 'DeFi participant',
                text: 'Repeated verified lending, borrowing or liquidity actions.',
                detail: 'DeFi actions · Protocols used',
              },
              {
                icon: Clock3,
                title: 'Long-term holder',
                text: 'A token retained through a verified 90-day balance and transfer history.',
                detail: 'Retention · Recent outgoing activity',
              },
              {
                icon: Images,
                title: 'NFT trader',
                text: 'Repeated verified NFT purchases or sales, rather than NFT transfers alone.',
                detail: 'Verified trades · Collections',
              },
              {
                icon: Coins,
                title: 'Staking participant',
                text: 'A verified active staking position backed by deposit history.',
                detail: 'Active position · Deposit history',
              },
              {
                icon: MoonStar,
                title: 'Dormant or new wallet',
                text: 'A short wallet-initiated history or an older wallet without recent initiated transactions.',
                detail: 'First activity · Lifetime history',
              },
            ].map(({ icon: Icon, title, text, detail }) => (
              <article key={title}>
                <Icon size={22} />
                <h3>{title}</h3>
                <p>{text}</p>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="home-workflow" id="how-it-works">
          <div className="landing-wrap workflow-layout">
            <div>
              <span className="section-number">02 / Profiling rules</span>
              <h2>
                How a wallet
                <br />
                is profiled.
              </h2>
              <p className="workflow-intro">
                Observable Ethereum activity is converted into profile scores
                with clear thresholds and supporting evidence.
              </p>
            </div>
            <div className="workflow-summary">
              <ol>
                {[
                  [
                    'Observe wallet behavior',
                    'Retrieve Ethereum activity, balances and the records needed by each rule.',
                  ],
                  [
                    'Add protocol context',
                    'Verify action types and wallet roles before counting protocol activity.',
                  ],
                  [
                    'Score each profile',
                    'Evaluate six profiles independently and show missing inputs when a result cannot be assessed.',
                  ],
                ].map(([title, text], i) => (
                  <li key={title}>
                    <span>0{i + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <a
                className="docs-download"
                href="/OnChain-Wallet-Profiler-Methodology.pdf"
                download
              >
                <span className="docs-download-icon">
                  <FileDown size={19} />
                </span>
                <span>
                  <strong>Download docs</strong>
                  <small>Methodology and example output · PDF, 3 pages</small>
                </span>
                <ArrowRight size={17} />
              </a>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-wrap landing-footer">
        <a href="/" className="brand">
          <Blocks size={20} />
          <span>OnChain</span>
        </a>
        <p>Ethereum wallet analytics</p>
        <a href="/profiler">
          Open profiler <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
