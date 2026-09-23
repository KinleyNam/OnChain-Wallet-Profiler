import './wallet-loading.css';

const tabs = [
  ['overview', 'Overview'], ['balances', 'Balances'], ['activity', 'Activity'],
  ['movements', 'Token movements'], ['flows', 'Fund flows'],
  ['protocols', 'Protocols used'], ['risk', 'Risk indicators'],
  ['evidence', 'Profile evidence'],
] as const;

function LoadingValue({ width = 'medium' }: { width?: 'short' | 'medium' | 'long' }) {
  return <span className={`loading-value loading-value-${width}`} aria-hidden="true" />;
}

export function WalletLoading({ tab, period }: { tab: string; period: string }) {
  return (
    <output className="wallet-loading" aria-label="Loading wallet analysis">
      <div className="wallet-heading">
        <div>
          <div className="wallet-title"><span className="network-label">Ethereum</span><LoadingValue width="medium" /></div>
          <p>Analysis period: Last {period} days</p>
        </div>
        <span className="loading-progress"><span className="loading-spinner" aria-hidden="true" />Loading analysis</span>
      </div>
      <section className="analysis-status" aria-label="Loading analysis information">
        {['Data source', 'Profiles assessed', 'Records processed', 'Rule version'].map((label) => (
          <div key={label}><span>{label}</span><LoadingValue width="short" /></div>
        ))}
      </section>
      <section className="identity-card profile-feature loading-profile" aria-label="Loading behavioral profile">
        <div className="profile-summary">
          <div className="identity-heading">Behavioral profile <span className="profile-period">{period}-day analysis</span></div>
          <LoadingValue width="long" />
          <div className="loading-description"><LoadingValue width="long" /></div>
        </div>
        <div className="profile-anomaly">
          <span className="loading-label">Behavioral anomaly</span>
          <LoadingValue width="short" />
          <div className="loading-track" />
          <div className="scale"><span>Typical</span><span>Unusual</span></div>
        </div>
        <dl className="profile-signals">
          {['Active days', 'Protocols used', 'Transaction frequency'].map((label) => (
            <div key={label}><dt>{label}</dt><dd><LoadingValue width="short" /></dd></div>
          ))}
        </dl>
      </section>
      <div className="main-tabs loading-tabs" aria-label="Profiler sections">
        {tabs.map(([id, label]) => <span key={id} className={id === tab ? 'loading-tab-active' : ''}>{label}</span>)}
      </div>
      {tab === 'overview' ? (
        <>
          <section className="stats-grid" aria-label="Loading wallet statistics">
            {['Transactions', 'Transfer volume', 'Unique counterparties', 'Active days'].map((label) => (
              <div className="stat" key={label}><span>{label}</span><LoadingValue width="medium" /></div>
            ))}
          </section>
          <div className="main-grid">
            <section className="panel loading-detail"><h2>Activity over time</h2><div className="loading-chart" /></section>
            <section className="panel loading-detail"><h2>Protocols used</h2>{[0, 1].map((n) => <div className="loading-row" key={n}><LoadingValue width="medium" /><LoadingValue width="short" /></div>)}</section>
          </div>
          <section className="panel loading-detail loading-table" aria-label="Loading Ethereum assets">
            <h2>Assets on Ethereum</h2>
            <div className="loading-table-heading"><span>Asset</span><span>Balance</span><span>Value</span></div>
            {[0, 1].map((n) => <div className="loading-row" key={n}><LoadingValue width="medium" /><LoadingValue width="short" /><LoadingValue width="short" /></div>)}
          </section>
        </>
      ) : (
        <section className="panel loading-detail loading-table" aria-label={`Loading ${tabs.find(([id]) => id === tab)?.[1] ?? 'wallet'} data`}>
          <h2>{tabs.find(([id]) => id === tab)?.[1] ?? 'Wallet details'}</h2>
          <div className="loading-table-heading"><LoadingValue width="medium" /><LoadingValue width="short" /><LoadingValue width="short" /></div>
          {[0, 1, 2].map((n) => <div className="loading-row" key={n}><LoadingValue width="medium" /><LoadingValue width="short" /><LoadingValue width="short" /></div>)}
        </section>
      )}
    </output>
  );
}
