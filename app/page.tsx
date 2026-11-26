import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { usd, type WalletData } from '@/lib/wallet-data';
import {
  AnalysisApiError,
  downloadWalletExport,
  loadWalletAnalysis,
} from '@/lib/analysis-api';
import { WalletLoading } from './wallet-loading';
import { ActivitySummary, FlowOverview, MetricCards, MovementSummary, OverviewProfile, ProtocolOverview, RiskOverview } from './dashboard-views';
import { ProfileTransactionProof } from './profile-transaction-proof';
import type { ProfileResult } from '../server/analysis';
import {
  BalancesPanel,
  MovementPanel,
  FundFlows,
  TransactionTable,
} from './wallet-panels';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Info,
  Search,
  Wallet,
  ArrowDownUp,
  BarChart3,
  BookOpen,
  Layers3,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const ActivityChart = lazy(() => import('./activity-chart'));

const tabRoutes = {
  overview: 'Overview',
  balances: 'Balances',
  activity: 'Activity',
  movements: 'Token-movements',
  flows: 'Fund-flows',
  protocols: 'Protocols-used',
  risk: 'Risk-indicators',
  evidence: 'Profile-evidence',
} as const;
type TabId = keyof typeof tabRoutes;
function tabFromPath(pathname = window.location.pathname): TabId {
  const segment = pathname.replace(/\/$/, '').split('/').at(-1)?.toLowerCase();
  return (
    Object.entries(tabRoutes).find(
      ([, route]) => route.toLowerCase() === segment,
    )?.[0] as TabId | undefined
  ) ?? 'overview';
}
export default function Home() {
  const initialParams = new URLSearchParams(window.location.search);
  const suppliedAddress = initialParams.get('address')?.trim() ?? '';
  const initialAddress = /^0x[a-fA-F0-9]{40}$/.test(suppliedAddress)
    ? suppliedAddress
    : '';
  const [input, setInput] = useState(initialAddress),
    [address, setAddress] = useState(initialAddress),
    [tab, setTab] = useState<TabId>(() => tabFromPath()),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false),
    [analysisId, setAnalysisId] = useState(''),
    [serverProfiles, setServerProfiles] = useState<ProfileResult[] | null>(null),
    [serverPrimary, setServerPrimary] = useState(''),
    [dataSource, setDataSource] = useState(''),
    [ruleVersion, setRuleVersion] = useState(''),
    [mappingVersion, setMappingVersion] = useState(''),
    [providerCutoff, setProviderCutoff] = useState<string | null>(null),
    [serverIndicators, setServerIndicators] = useState<{ score: number; band: string; signals: Array<{ name: string; detected: boolean; value: string }> } | null>(null),
    [serviceError, setServiceError] = useState(''),
    [serviceErrorCode, setServiceErrorCode] = useState(''),
    [retry, setRetry] = useState(0),
    [modal, setModal] = useState<string | null>(null),
    [copied, setCopied] = useState(false),
    [selectedProtocol, setSelectedProtocol] = useState<string | null>(null),
    [walletData, setWalletData] = useState<WalletData | null>(null);
  const transactionByHash = useMemo(
    () => new Map((walletData?.transactions ?? []).map((transaction) => [transaction.hash.toLowerCase(), transaction])),
    [walletData],
  );
  const [monthSelection, setMonthSelection] = useState<{ analysisId: string; month: string } | null>(null);
  function updateRoute(nextTab: TabId, mode: 'push' | 'replace' = 'push') {
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/profiler/${tabRoutes[nextTab]}`;
    if (address) nextUrl.searchParams.set('address', address);
    else nextUrl.searchParams.delete('address');
    nextUrl.searchParams.delete('demo');
    nextUrl.searchParams.delete('period');
    window.history[mode === 'push' ? 'pushState' : 'replaceState'](
      {},
      '',
      nextUrl,
    );
    setTab(nextTab);
    setSelectedProtocol(null);
  }
  useEffect(() => {
    const currentTab = tabFromPath();
    const needsTabPath = window.location.pathname.replace(/\/$/, '') === '/profiler';
    if (needsTabPath || new URLSearchParams(window.location.search).has('period') || new URLSearchParams(window.location.search).has('demo')) {
      const nextUrl = new URL(window.location.href);
      if (needsTabPath) nextUrl.pathname = `/profiler/${tabRoutes[currentTab]}`;
      if (initialAddress) nextUrl.searchParams.set('address', initialAddress);
      else nextUrl.searchParams.delete('address');
      nextUrl.searchParams.delete('demo');
      nextUrl.searchParams.delete('period');
      window.history.replaceState({}, '', nextUrl);
    }
    function restoreRoute() {
      const params = new URLSearchParams(window.location.search);
      const restoredAddress = params.get('address')?.trim() ?? '';
      setTab(tabFromPath());
      const nextAddress = restoredAddress;
      if (/^0x[a-fA-F0-9]{40}$/.test(nextAddress)) {
        if (nextAddress !== address) setReady(false);
        setAddress(nextAddress);
        setInput(nextAddress);
      } else {
        setAddress('');
        setInput('');
        setWalletData(null);
        setServerProfiles(null);
        setServerIndicators(null);
        setReady(false);
      }
      if (params.has('period') || params.has('demo')) {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('period');
        cleanUrl.searchParams.delete('demo');
        window.history.replaceState({}, '', cleanUrl);
      }
      setSelectedProtocol(null);
    }
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, [initialAddress, address]);
  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    loadWalletAnalysis(address, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setWalletData(result.wallet);
        setAnalysisId(result.analysisId);
        setServerProfiles(result.profiles.items);
        setServerPrimary(result.profiles.primaryProfile);
        setDataSource((result.analysis.sources ?? [result.analysis.source]).map((source) =>
          source === 'nansen' ? 'Nansen API' : source === 'etherscan' ? 'Etherscan API' :
            'Alchemy API',
        ).join(' + '));
        setRuleVersion(result.analysis.ruleVersion);
        setMappingVersion(result.analysis.mappingVersion);
        setProviderCutoff(result.analysis.providerDataCutoff);
        setServerIndicators(result.indicators);
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setServiceError(cause instanceof Error ? cause.message : 'The analysis service is unavailable.');
        setServiceErrorCode(cause instanceof AnalysisApiError ? cause.code ?? '' : '');
      });
    return () => controller.abort();
  }, [address, retry]);
  function analyze(value = input) {
    const nextAddress = value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(nextAddress)) {
      setError(
        'Enter a valid Ethereum address: 0x followed by 40 hexadecimal characters.',
      );
      return;
    }
    setError('');
    setServiceError('');
    setServiceErrorCode('');
    setReady(false);
    setAddress(nextAddress);
    setRetry((value) => value + 1);
    setInput(nextAddress);
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/profiler/${tabRoutes.overview}`;
    nextUrl.searchParams.set('address', nextAddress);
    nextUrl.searchParams.delete('demo');
    nextUrl.searchParams.delete('period');
    window.history.replaceState({}, '', nextUrl);
    setTab('overview');
    setSelectedProtocol(null);
  }
  if (!walletData || !ready || !serverProfiles || !serverIndicators) {
    const isIdle = !address && !serviceError;
    return (
      <div className={`app-shell${isIdle ? ' profiler-idle-shell' : ''}`}>
        <main className="workspace">
          <header className="topbar">
            <div className="topbar-inner">
              <div className="brand-group">
                <a className="brand" href="/" aria-label="OnChain home">
                  <img className="brand-logo" src="/brand-logo.png" alt="" />
                  <span>OnChain Wallet Profiler</span>
                </a>
              </div>
            </div>
          </header>
          <div className={`page${isIdle ? ' profiler-idle-page' : ''}`}>
            {isIdle ? <>
              <div className="profiler-idle-controls">
                <div className="profiler-idle-identity" aria-hidden="true">
                  <code>0x••••••••••••••••••••</code>
                  <span>No risk identified</span>
                </div>
                <form className="search-form profiler-idle-search" onSubmit={(event) => { event.preventDefault(); analyze(); }}>
                  <div className="profiler-idle-input">
                    <Search size={20} />
                    <input aria-label="Ethereum wallet address" value={input} onChange={(event) => setInput(event.target.value)} placeholder="0x… paste any Ethereum wallet address" spellCheck={false} />
                  </div>
                  <button className="primary" type="submit">Analyze <ArrowRight size={17} /></button>
                </form>
              </div>
              {error && <p className="error profiler-idle-error" role="alert">{error}</p>}
              <section className="profiler-empty" aria-labelledby="profiler-empty-title">
                <span className="profiler-empty-icon" aria-hidden="true"><Wallet size={46} strokeWidth={1.7} /></span>
                <h2 id="profiler-empty-title">Enter a wallet address to start analysis</h2>
                <p>Paste an Ethereum externally owned account above. Smart contract addresses are identified before analysis begins.</p>
              </section>
              <footer className="footer profiler-idle-footer">
                <span>OnchainWalletProfiler</span>
                <span>Powered by Nansen AI</span>
                <span>© {new Date().getFullYear()}</span>
              </footer>
            </> : <>
              <div className="page-title"><h1>Wallet profiler</h1><p>Understand a wallet through its behavior.</p></div>
              <form className="search-form" onSubmit={(event) => { event.preventDefault(); analyze(); }}>
                <Search size={20} />
                <input aria-label="Ethereum wallet address" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter an Ethereum wallet address (0x…)" spellCheck={false} />
                <span className="lifetime-scope">Full lifetime</span>
                <button className="primary" type="submit">Analyze wallet <ArrowRight size={17} /></button>
              </form>
              {error && <p className="error" role="alert">{error}</p>}
              {serviceError ? <div role="alert" className="loading-error">
                <h2>{serviceErrorCode === 'SMART_CONTRACT_ADDRESS' ? 'Smart contract detected' : 'Analysis unavailable'}</h2>
                <p>{serviceError}</p>
                {serviceErrorCode !== 'SMART_CONTRACT_ADDRESS' && (
                  <button className="secondary" type="button" onClick={() => { setServiceError(''); setServiceErrorCode(''); setRetry((value) => value + 1); }}>Try again</button>
                )}
              </div> : <WalletLoading tab={tab} />}
            </>}
          </div>
        </main>
      </div>
    );
  }
  const protocols = walletData.protocols;
  const asOf = Date.parse(walletData.asOf);
  const startDay = Date.parse(walletData.start);
  const dateForIndex = (index: number) => new Date(startDay + index * 86_400_000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const endDate = new Date(asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const days = walletData.days,
    daily = walletData.daily,
    count = daily.reduce((a, b) => a + b, 0),
    active = daily.filter((n) => n > 0).length;
  const firstObserved = walletData.firstActivity
    ? new Date(walletData.firstActivity).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null;
  const observedDays = walletData.firstActivity
    ? Math.max(1, Math.floor((asOf - Date.parse(walletData.firstActivity)) / 86_400_000) + 1)
    : 0;
  const chartStart = walletData.firstActivity
    ? Math.max(0, Math.floor((Date.parse(walletData.firstActivity.slice(0, 10) + 'T00:00:00Z') - startDay) / 86_400_000))
    : 0;
  const activityCutoff = Math.min(asOf, Date.now());
  const chartDays = Math.min(days, daily.length, Math.max(0, Math.floor((activityCutoff - startDay) / 86_400_000) + 1));
  const monthlyCounts = new Map<string, number>();
  for (let index = 0; index < chartDays; index++) {
    if (!daily[index]) continue;
    const month = new Date(startDay + index * 86_400_000).toISOString().slice(0, 7);
    monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + daily[index]);
  }
  const lastYear = new Date(activityCutoff).getUTCFullYear();
  const firstYear = Math.min(lastYear, new Date(walletData.firstActivity ?? activityCutoff).getUTCFullYear());
  const heatYears = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const busiestMonth = Math.max(0, ...monthlyCounts.values());
  const identifiedProtocolShare = protocols
    .filter((p) => !['Unknown', 'No protocol'].includes(p.name))
    .reduce((sum, p) => sum + p.share, 0);
  const namedProtocols = protocols.filter(
    (protocol) =>
      protocol.count > 0 &&
      !['Unknown', 'No protocol'].includes(protocol.name),
  );
  const directTransfers = protocols.find(
    (protocol) => protocol.name === 'No protocol' && protocol.count > 0,
  );
  const unattributed = protocols.find(
    (protocol) => protocol.name === 'Unknown' && protocol.count > 0,
  );
  const profileResults = serverProfiles;
  const assignedProfiles = profileResults.filter((profile) => profile.assigned).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const classification = serverPrimary;
  const riskScore = serverIndicators.score;
  const riskBand = serverIndicators.band;
  const riskSignals = serverIndicators.signals;
  const selectedMonth = monthSelection?.analysisId === analysisId ? monthSelection.month : null;
  const monthlyTransactions = selectedMonth
    ? walletData.transactions.filter((transaction) => transaction.timestamp.startsWith(selectedMonth))
    : walletData.transactions;
  const recentStart = Math.min(chartDays, Math.max(chartStart, chartDays - 26 * 7));
  const chart = Array.from({ length: Math.ceil((chartDays - recentStart) / 7) }, (_, i) => {
    const start = recentStart + i * 7;
    const end = Math.min(start + 7, chartDays);
    return {
      day: dateForIndex(start),
      range: `${dateForIndex(start)} – ${dateForIndex(end - 1)}`,
      transactions: daily.slice(start, end).reduce((a, b) => a + b, 0),
    };
  });
  const pnl = walletData.tradePerformance?.realizedPnlUsd;
  const hasPnl = typeof pnl === 'number' && Number.isFinite(pnl);
  async function exportCard() {
    try {
      const blob = await downloadWalletExport(analysisId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'onchain-wallet-profile.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export this profile.');
    }
  }
  const protocolPanel = (
    <section className="panel protocols">
      <div className="panel-heading">
        <div>
          <h2>Protocols used</h2>
          <p>Named transactions across available lifetime history. Select a protocol to inspect them.</p>
        </div>
      </div>
      {namedProtocols.length ? (
        <>
          <div className="stackbar">
            {namedProtocols.map((p) => (
            <span
              key={p.name}
              style={{ width: p.share + '%', background: p.color }}
            />
            ))}
          </div>
          {namedProtocols.map((p) => (
            <button className="protocol-row" key={p.name} onClick={() => setSelectedProtocol(p.name)}>
            <span
              className="protocol-icon"
              style={{ color: p.color, background: p.color + '18' }}
            >
              {p.letter}
            </span>
            <span className="protocol-name">
              <b>{p.name}</b>
              <small>{p.type}</small>
            </span>
            <span>
              <b>{p.share.toFixed(1)}%</b>
              <small>{p.count.toLocaleString()} transactions</small>
            </span>
            <ArrowUpRight size={14} />
            </button>
          ))}
        </>
      ) : (
        <div className="protocol-empty">
          <b>No named protocol transactions detected</b>
          <p>The available transactions do not identify a protocol.</p>
        </div>
      )}
      {(directTransfers || unattributed) && (
        <div className="protocol-context">
          <span>Other wallet activity</span>
          {directTransfers && (
            <button type="button" onClick={() => setSelectedProtocol('No protocol')}>
              <span><b>Direct transfers</b><small>Wallet-to-wallet activity</small></span>
              <strong>{directTransfers.count.toLocaleString()}</strong>
            </button>
          )}
          {unattributed && (
            <button type="button" onClick={() => setSelectedProtocol('Unknown')}>
              <span><b>Unattributed</b><small>Protocol could not be verified</small></span>
              <strong>{unattributed.count.toLocaleString()}</strong>
            </button>
          )}
        </div>
      )}
    </section>
  );
  const heatmap = (
    <section className="panel heat-panel">
      <div className="panel-heading">
        <div>
          <h2>Activity heatmap</h2>
          <p>
            {active.toLocaleString()} active days across available history
          </p>
        </div>
        <span className="subtle">Monthly transactions</span>
      </div>
      <div className="heat-scroll lifetime-heat-scroll">
        <div className="lifetime-heatmap">
          <span className="heat-year-heading">Year</span>
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) =>
            <span className="heat-month-heading" key={month}>{month}</span>
          )}
          {heatYears.flatMap((year) => [
            <span className="heat-year" key={`year-${year}`}>{year}</span>,
            ...Array.from({ length: 12 }, (_, index) => {
              const month = `${year}-${String(index + 1).padStart(2, '0')}`;
              const value = monthlyCounts.get(month) ?? 0;
              const outsideWalletHistory = (year === firstYear && index + 1 < new Date(walletData.firstActivity ?? asOf).getUTCMonth() + 1)
                || Date.UTC(year, index, 1) > activityCutoff;
              const level = value && busiestMonth ? Math.max(1, Math.ceil((value / busiestMonth) * 5)) : 0;
              const label = new Date(Date.UTC(year, index, 1)).toLocaleDateString('en-US', {
                month: 'long', year: 'numeric', timeZone: 'UTC',
              });
              return <button
                type="button"
                key={month}
                disabled={outsideWalletHistory}
                className={`heat level-${outsideWalletHistory ? 0 : level}`}
                aria-label={outsideWalletHistory ? `${label}: outside available history` : `${label}: ${value.toLocaleString()} transactions`}
                title={outsideWalletHistory ? `${label}: outside available history` : `${label}: ${value.toLocaleString()} transactions`}
                aria-pressed={selectedMonth === month}
                onClick={() => {
                  setMonthSelection({ analysisId, month });
                  if (tab !== 'activity') updateRoute('activity');
                }}
              />;
            }),
          ])}
        </div>
      </div>
      <div className="heat-footer">
        <span>{firstObserved ?? 'No observed transactions'}</span>
        <span>{endDate}</span>
        <div>
          0 transactions{' '}
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={'heat level-' + n} />
          ))}{' '}
          {busiestMonth.toLocaleString()} transactions
        </div>
      </div>
    </section>
  );
  const activityChart = (
    <Suspense
      fallback={
        <section className="panel activity-panel" aria-busy="true">
          <div className="panel-heading">
            <div>
              <h2>Transaction activity</h2>
              <p>Preparing chart…</p>
            </div>
          </div>
          <div className="chart" />
        </section>
      }
    >
      <ActivityChart data={chart} timeframe={chart.length ? `${chart[0].day} – ${dateForIndex(chartDays - 1)}` : 'No available activity dates'} />
    </Suspense>
  );
  return (
    <div className="app-shell">
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand-group">
              <a className="brand" href="/" aria-label="OnChain home">
                <img className="brand-logo" src="/brand-logo.png" alt="" />
                <span>OnChain Wallet Profiler</span>
              </a>
            </div>
            <button className="secondary export" onClick={exportCard}>
              <Download size={16} /> Export profile
            </button>
          </div>
        </header>
        <div className="page">
          <div className="page-title">
            <div>
              <h1>Wallet profiler</h1>
              <p>Understand a wallet through its behavior.</p>
            </div>
          </div>
          <div className="dashboard-query-row">
          <div className="wallet-heading">
            <div>
              <div className="wallet-title">
                <span className="network-label">Ethereum</span>
                <h2>
                  {address.slice(0, 6)}…{address.slice(-4)}
                </h2>
                <button
                  aria-label="Copy wallet address"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    } catch {
                      setModal(address);
                    }
                  }}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
              <p>Available history: {firstObserved ?? dateForIndex(0)} – {endDate}</p>
            </div>
          </div>
          <form
            className="search-form"
            onSubmit={(e) => {
              e.preventDefault();
              analyze();
            }}
          >
            <Search size={20} />
            <input
              aria-label="Ethereum wallet address"
              placeholder="Enter an Ethereum wallet address (0x…)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
            />
            <span className="lifetime-scope">Full lifetime</span>
            <button className="primary" type="submit">
              Analyze wallet
              <ArrowRight size={17} />
            </button>
          </form>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {walletData.transactionCoverage?.complete === false && (
            <p className="provenance">
              Transaction limit reached. This analysis uses {walletData.transactionCoverage.fetched.toLocaleString()} fetched transactions
              and other available wallet data. Transaction totals and activity charts are partial;
              profile scores use the available verified activity and existing scoring rules.
            </p>
          )}
          <Tabs
            id="wallet-details"
            value={tab}
            onValueChange={(v) => {
              const nextTab = v as TabId;
              if (nextTab !== tab) updateRoute(nextTab);
            }}
          >
            <TabsList variant="line" className="main-tabs">
              <TabsTrigger value="overview"><BarChart3 size={15} /> Overview</TabsTrigger>
              <TabsTrigger value="balances"><Wallet size={15} /> Balances</TabsTrigger>
              <TabsTrigger value="activity"><Activity size={15} /> Activity</TabsTrigger>
              <TabsTrigger value="movements"><ArrowDownUp size={15} /> Token movements</TabsTrigger>
              <TabsTrigger value="flows"><Waves size={15} /> Fund flows</TabsTrigger>
              <TabsTrigger value="protocols"><Layers3 size={15} /> Protocols used</TabsTrigger>
              <TabsTrigger value="risk"><ShieldCheck size={15} /> Risk indicators</TabsTrigger>
              <TabsTrigger value="evidence"><BookOpen size={15} /> Profile evidence</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="design-overview-top">
                <OverviewProfile profiles={profileResults} primary={classification} />
                <div className="design-overview-side">
                  <MetricCards items={[
                    { label: 'Total balance', value: usd(walletData.totalBalance), note: 'Current Ethereum assets' },
                    { label: 'Transactions', value: count.toLocaleString(), note: 'Available lifetime history' },
                    { label: 'Active days', value: active.toLocaleString(), note: `${observedDays} observed days` },
                    { label: 'Activity indicator', value: `${riskScore}/100`, note: riskBand, tone: `risk-tone-${riskBand.toLowerCase()}` },
                    {
                      label: 'Realized P&L',
                      value: hasPnl ? `${pnl > 0 ? '+' : pnl < 0 ? '−' : ''}${usd(Math.abs(pnl))}` : 'Unavailable',
                      tone: hasPnl ? (pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : undefined) : undefined,
                      note: hasPnl ? 'Provider-reported trading results' : 'No trading results supplied',
                    },
                  ]} />
                </div>
              </div>
              <div className="main-grid overview-activity-grid">
                <div className="left-col">{activityChart}</div>
                <div className="right-col overview-activity-side">
                  <MetricCards items={[
                    { label: 'Transaction frequency', value: (count / Math.max(1, observedDays)).toFixed(1), note: 'Per observed day' },
                    { label: 'Counterparties', value: walletData.counterparties.toLocaleString(), note: 'Distinct addresses' },
                  ]} />
                  <div className="design-card overview-context">The profile and activity figures use available verified records. Open Profile evidence to see missing inputs and matched rules.</div>
                </div>
              </div>
              {heatmap}
            </TabsContent>
            <TabsContent value="activity">
              <ActivitySummary data={walletData} activeDays={active} />
              <section className="panel transaction-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Transaction history</h2>
                    <p>
                      Open a transaction for its token transfers, or select a
                      protocol.
                    </p>
                  </div>
                </div>
                {selectedMonth && <div className="ledger-toolbar">
                  <span>Showing {new Date(`${selectedMonth}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })} (UTC)</span>
                  <button type="button" className="secondary" onClick={() => setMonthSelection(null)}>Clear month</button>
                </div>}
                <TransactionTable
                  key={address + walletData.asOf + (selectedMonth ?? '')}
                  transactions={monthlyTransactions}
                  onProtocol={setSelectedProtocol}
                />
              </section>
              {heatmap}
            </TabsContent>
            <TabsContent value="balances">
              <BalancesPanel key={address + walletData.asOf} data={walletData} />
            </TabsContent>
            <TabsContent value="movements">
              <MovementSummary data={walletData} />
              <MovementPanel
                key={address + walletData.asOf}
                movements={walletData.movements}
              />
              <MovementSummary data={walletData} section="totals" />
            </TabsContent>
            <TabsContent value="flows">
              <FlowOverview data={walletData} />
              <FundFlows key={address + walletData.asOf} data={walletData} />
            </TabsContent>
            <TabsContent value="protocols">
              <ProtocolOverview protocols={protocols} data={walletData} />
              {protocolPanel}
            </TabsContent>
            <TabsContent value="risk">
              <RiskOverview score={riskScore} band={riskBand} signals={riskSignals} />
            </TabsContent>
            <TabsContent value="evidence">
              <MetricCards items={[
                { label: 'Profiles assessed', value: `${profileResults.filter((profile) => profile.status !== 'NOT_ASSESSED').length} / ${profileResults.length}` },
                { label: 'Profiles assigned', value: assignedProfiles.length.toLocaleString() },
                { label: 'Signals triggered', value: `${riskSignals.filter((signal) => signal.detected).length} / ${riskSignals.length}` },
                { label: 'Records processed', value: count.toLocaleString() },
              ]} />
              <section className="panel rule-results figma-evidence-list">
                <div className="panel-heading">
                  <div>
                    <h2>Profile evidence</h2>
                    <p>Independent decisions under {ruleVersion} · {mappingVersion}. Expand related transactions beneath each result when available.</p>
                  </div>
                </div>
                {profileResults.map((profile) => {
                  return (
                    <div className="rule-result" key={profile.name}>
                      <div>
                        <b>{profile.name}</b>
                        <p>{profile.evidence}</p>
                        {!!profile.matchedRules.length && <p>Matched rules: {profile.matchedRules.map((rule) => `${rule.id} +${rule.points}`).join(', ')}</p>}
                        <ProfileTransactionProof profile={profile} transactionByHash={transactionByHash} />
                      </div>
                      <span>
                        {profile.status === 'NOT_ASSESSED' ? 'Not enough data' :
                          profile.status === 'ASSIGNED' ? `${profile.score === null ? (profile.reason === 'new' ? 'New wallet' : 'Dormant wallet') : `${profile.score}/100`} · Assigned` :
                            `${profile.score === null ? 'Condition not met' : `${profile.score}/100`} · Not assigned`}
                      </span>
                    </div>
                  );
                })}
              </section>
              <section className="panel data-provenance">
                <div className="panel-heading">
                  <div>
                    <h2>Data coverage and provenance</h2>
                    <p>What was available for this analysis</p>
                  </div>
                </div>
                <dl>
                  <div><dt>Sources</dt><dd>{dataSource}</dd></div>
                  <div><dt>Mapping version</dt><dd>{mappingVersion}</dd></div>
                  <div><dt>Analysis scope</dt><dd>Full lifetime · available records from {firstObserved ?? dateForIndex(0)} to {endDate}</dd></div>
                  <div><dt>Profile assessability</dt><dd>{profileResults.filter((profile) => profile.status !== 'NOT_ASSESSED').length} of {profileResults.length} assessed</dd></div>
                  <div><dt>Processed records</dt><dd>{count.toLocaleString()} transactions</dd></div>
                  <div><dt>Protocol attribution</dt><dd>{identifiedProtocolShare.toFixed(1)}% identified</dd></div>
                  <div><dt>Balance snapshots (last 90 days)</dt><dd>{walletData.enrichmentCoverage.historicalBalances ? `${walletData.historicalBalances.length.toLocaleString()} records` : 'Unavailable'}</dd></div>
                  <div><dt>Dedicated counterparties</dt><dd>{walletData.enrichmentCoverage.counterparties ? `${walletData.flows.length.toLocaleString()} returned` : 'Unavailable'}</dd></div>
                  <div><dt>Trade performance</dt><dd>{walletData.enrichmentCoverage.tradePerformance ? 'Available' : 'Unavailable'}</dd></div>
                  <div><dt>Analysis cutoff</dt><dd>{new Date(asOf).toLocaleString('en-US', { timeZone: 'UTC' })} UTC</dd></div>
                  <div><dt>Provider cutoff</dt><dd>{providerCutoff ? `${new Date(providerCutoff).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : 'Not reported'}</dd></div>
                </dl>
                <div className="provenance">
                  <Info size={18} /> Provider pages are retrieved before a profile is saved. If one provider is unavailable, another configured source may complete the analysis. Profiles without sufficient evidence remain unassessed.
                </div>
              </section>
              <section className="panel methodology">
                <h2>How to read this profile</h2>
                <div className="detail-grid">
                  <div>
                    <h3>Behavioral profiles</h3>
                    <p>
                      Active Trader, Long-Term Holder, DeFi Participant,
                      Staking Participant, and Dormant or New Wallet
                      are assessed independently. A
                      wallet may match several profiles. Read every result with
                      its decision status, score where assessable, and supporting evidence.
                    </p>
                  </div>
                  <div>
                    <h3>Behavioral anomaly score</h3>
                    <p>
                      Read this activity indicator alongside the supporting
                      evidence and available history. It is not a fraud,
                      sanction, credit, security or investment-risk rating.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>
          <footer className="footer">
            <span>
              <img className="footer-logo" src="/brand-logo.png" alt="" /> OnChain Wallet Profiler
            </span>
            <span>Powered by Nansen AI</span>
            <span>© {new Date().getFullYear()} OnChain Wallet Profiler</span>
          </footer>
        </div>
      </main>
      <Dialog
        open={!!selectedProtocol}
        onOpenChange={(open) => !open && setSelectedProtocol(null)}
      >
        <DialogContent className="protocol-dialog">
          <DialogTitle>
            {selectedProtocol === 'Unknown'
              ? 'Unattributed transactions'
              : selectedProtocol === 'No protocol'
                ? 'Direct wallet transfers'
                : selectedProtocol + ' transactions'}
          </DialogTitle>
          <DialogDescription>
            Transactions for this wallet across available lifetime history. Expand a
            transaction to see every token movement and address.
          </DialogDescription>
          <TransactionTable
            key={address + walletData.asOf + selectedProtocol}
            transactions={walletData.transactions.filter(
              (t) => t.protocol === selectedProtocol,
            )}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="detail-modal">
          <DialogTitle>Profile details</DialogTitle>
          <DialogDescription>{modal}</DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
}
