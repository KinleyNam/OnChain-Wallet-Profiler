import { useEffect, useState } from 'react';
import { usd, type WalletData } from '@/lib/wallet-data';
import { downloadWalletExport, loadWalletAnalysis } from '@/lib/analysis-api';
import { WalletLoading } from './wallet-loading';
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
  Blocks,
  Check,
  Copy,
  Download,
  Info,
  Search,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const example = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
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
    : example;
  const suppliedPeriod = initialParams.get('period');
  const initialPeriod = ['30', '90', '180'].includes(suppliedPeriod ?? '')
    ? suppliedPeriod!
    : '30';
  const [input, setInput] = useState(initialAddress),
    [address, setAddress] = useState(initialAddress),
    [period, setPeriod] = useState(initialPeriod),
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
    [retry, setRetry] = useState(0),
    [modal, setModal] = useState<string | null>(null),
    [copied, setCopied] = useState(false),
    [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  function updateRoute(nextTab: TabId, mode: 'push' | 'replace' = 'push') {
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/profiler/${tabRoutes[nextTab]}`;
    nextUrl.searchParams.set('address', address);
    nextUrl.searchParams.set('period', period);
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
    if (window.location.pathname.replace(/\/$/, '') === '/profiler') {
      const nextUrl = new URL(window.location.href);
      nextUrl.pathname = `/profiler/${tabRoutes[currentTab]}`;
      nextUrl.searchParams.set('address', initialAddress);
      nextUrl.searchParams.set('period', initialPeriod);
      window.history.replaceState({}, '', nextUrl);
    }
    function restoreRoute() {
      const params = new URLSearchParams(window.location.search);
      const restoredAddress = params.get('address')?.trim() ?? '';
      const restoredPeriod = params.get('period');
      setTab(tabFromPath());
      if (/^0x[a-fA-F0-9]{40}$/.test(restoredAddress)) {
        if (restoredAddress !== address) setReady(false);
        setAddress(restoredAddress);
        setInput(restoredAddress);
      }
      if (['30', '90', '180'].includes(restoredPeriod ?? '')) {
        if (restoredPeriod !== period) setReady(false);
        setPeriod(restoredPeriod!);
      }
      setSelectedProtocol(null);
    }
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, [initialAddress, initialPeriod, address, period]);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    loadWalletAnalysis(address, Number(period), controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setWalletData(result.wallet);
        setAnalysisId(result.analysisId);
        setServerProfiles(result.profiles.items);
        setServerPrimary(result.profiles.primaryProfile);
        setDataSource(result.analysis.source);
        setRuleVersion(result.analysis.ruleVersion);
        setMappingVersion(result.analysis.mappingVersion);
        setProviderCutoff(result.analysis.providerDataCutoff);
        setServerIndicators(result.indicators);
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setServiceError(cause instanceof Error ? cause.message : 'The analysis service is unavailable.');
      });
    return () => controller.abort();
  }, [address, period, retry]);
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
    setReady(false);
    setAddress(nextAddress);
    setRetry((value) => value + 1);
    setInput(nextAddress);
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/profiler/${tabRoutes.overview}`;
    nextUrl.searchParams.set('address', nextAddress);
    nextUrl.searchParams.set('period', period);
    window.history.replaceState({}, '', nextUrl);
    setTab('overview');
    setSelectedProtocol(null);
  }
  if (!walletData || !ready || !serverProfiles || !serverIndicators) {
    return (
      <div className="app-shell">
        <main className="workspace">
          <header className="topbar">
            <div className="topbar-inner">
              <a className="brand" href="/" aria-label="OnChain home">
                <Blocks size={23} /><span>OnChain</span><span className="brand-divider" /><small>Wallet profiler</small>
              </a>
            </div>
          </header>
          <div className="page">
            <div className="page-title"><h1>Wallet profiler</h1><p>Understand a wallet through its behavior.</p></div>
            <form className="search-form" onSubmit={(event) => { event.preventDefault(); analyze(); }}>
              <Search size={20} />
              <input aria-label="Ethereum wallet address" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter an Ethereum wallet address (0x…)" spellCheck={false} />
              <select aria-label="Analysis period" className="period-select" value={period} onChange={(event) => {
                setPeriod(event.target.value);
                setServiceError('');
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('period', event.target.value);
                window.history.replaceState({}, '', nextUrl);
              }}>
                {['30', '90', '180'].map((value) => <option key={value} value={value}>Last {value} days</option>)}
              </select>
              <button className="primary" type="submit">Analyze wallet <ArrowRight size={17} /></button>
            </form>
            {error && <p className="error" role="alert">{error}</p>}
            {serviceError ? <div role="alert" className="loading-error">
              <h2>Analysis unavailable</h2>
              <p>{serviceError}</p>
              <button className="secondary" type="button" onClick={() => { setServiceError(''); setRetry((value) => value + 1); }}>Try again</button>
            </div> : <WalletLoading tab={tab} period={period} />}
          </div>
        </main>
      </div>
    );
  }
  const protocols = walletData.protocols;
  const asOf = Date.parse(walletData.asOf);
  const asOfDay = Date.parse(`${walletData.asOf.slice(0, 10)}T00:00:00Z`);
  const date = (day: number) => new Date(asOfDay + (day - 10) * 86_400_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const endDate = new Date(asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const days = Number(period),
    daily = walletData.daily,
    count = daily.reduce((a, b) => a + b, 0),
    active = daily.filter((n) => n > 0).length,
    anomalyScore = serverIndicators?.score ?? 0;
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
  const profileDescriptions: Record<string, string> = {
    'Active trader':
      'Frequent transactions and regular activity across the analysis period.',
    'Long-term holder':
      'A holding-oriented profile supported by at least 90 days of wallet history.',
    'DeFi participant':
      'Activity spans decentralized exchanges, lending and staking protocols.',
    'NFT trader':
      'Repeated marketplace activity across OpenSea, Blur or both.',
    'Staking participant':
      'Recurring staking activity and liquid-staking asset movements.',
    'Dormant or new wallet':
      'Recent activity and available wallet history support this profile.',
    'No profile assigned':
      'No profile reached its assignment threshold for this period.',
    'No profile matched':
      'The available verified evidence did not meet any assignment rule.',
    'Not enough data to classify':
      'The available source records do not verify the inputs required by these profile rules.',
  };
  const riskScore = serverIndicators.score;
  const riskBand = serverIndicators.band;
  const riskSignals = serverIndicators.signals;
  const chart = Array.from({ length: 15 }, (_, i) => ({
    day: date(11 - days + Math.floor((i * days) / 15)),
    transactions: daily
      .slice(Math.floor((i * days) / 15), Math.floor(((i + 1) * days) / 15))
      .reduce((a, b) => a + b, 0),
  }));
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
          <p>Select a protocol to inspect its transactions</p>
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
          <button
            className="protocol-row"
            key={p.name}
            onClick={() => setSelectedProtocol(p.name)}
          >
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
              <b>{p.share}%</b>
              <small>{p.count.toLocaleString()} transactions</small>
            </span>
            <ArrowUpRight size={14} />
          </button>
          ))}
        </>
      ) : (
        <div className="protocol-empty">
          <b>No named protocol interactions detected</b>
          <p>The activity in this period does not match a supported protocol.</p>
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
            {active} active days in the last {days} days
          </p>
        </div>
        <span className="subtle">Daily transactions</span>
      </div>
      <div className="heat-scroll">
        <div className="heat-labels">
          <span>Day 1</span>
          <span>Day 4</span>
          <span>Day 7</span>
        </div>
        <div
          className="heatmap"
          style={{
            gridTemplateColumns: `repeat(${Math.ceil(days / 7)},minmax(10px,1fr))`,
          }}
        >
          {Array.from({ length: Math.ceil(days / 7) * 7 }, (_, i) => {
            const value = daily[i] ?? 0,
              n = value === 0 ? 0 : Math.min(5, Math.ceil(value / 6));
            return (
              <button
                key={i}
                disabled={i >= days}
                className={'heat level-' + n}
                aria-label={`${date(11 - days + i)}: ${value} transactions`}
                title={`${date(11 - days + i)}: ${value} transactions`}
                onClick={() =>
                  setModal(
                    `${date(11 - days + i)}: ${value} transactions in the selected analysis period.`,
                  )
                }
              />
            );
          })}
        </div>
      </div>
      <div className="heat-footer">
        <span>{date(11 - days)}</span>
        <span>{endDate}</span>
        <div>
          Less{' '}
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <i key={n} className={'heat level-' + n} />
          ))}{' '}
          More
        </div>
      </div>
    </section>
  );
  const activityChart = (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h2>Transaction activity</h2>
          <p>Transactions per interval</p>
        </div>
        <span className="legend">
          <i /> Transactions
        </span>
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chart}
            margin={{ top: 12, right: 12, left: -22, bottom: 0 }}
          >
            <defs>
              <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--chart-line)"
                  stopOpacity={0.26}
                />
                <stop
                  offset="100%"
                  stopColor="var(--chart-line)"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="day"
              stroke="var(--text-muted)"
              axisLine={false}
              tickLine={false}
              minTickGap={45}
              fontSize={12}
            />
            <YAxis
              stroke="var(--text-muted)"
              axisLine={false}
              tickLine={false}
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
                borderRadius: 8,
              }}
            />
            <Area
              type="monotone"
              dataKey="transactions"
              stroke="var(--chart-line)"
              strokeWidth={2.5}
              fill="url(#activityFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
  const evidence = (
    <section className="panel evidence">
      <div className="panel-heading">
        <div>
          <h2>Supporting evidence</h2>
          <p>Activity indicators for this wallet.</p>
        </div>
      </div>
      {[
        [
          'Transaction activity',
          `${count} transactions across ${active} active days`,
          'Observed',
        ],
        [
          'Protocol coverage',
          `${protocols
            .filter((p) => !['Unknown', 'No protocol'].includes(p.name))
            .reduce((sum, p) => sum + p.share, 0)
            .toFixed(1)}% attributed to identified protocols`,
          'Attributed',
        ],
        [
          'Counterparties',
          `${walletData.counterparties} distinct counterparties across the selected period`,
          'Observed',
        ],
      ].map(([title, desc, confidence]) => (
        <div className="evidence-row" key={title}>
          <Check size={16} />
          <div>
            <b>{title}</b>
            <p>{desc}</p>
          </div>
          <span>{confidence}</span>
        </div>
      ))}
      <div className="provenance">
        <Info size={16} />
        <div>
          Analysis ends {endDate}.{' '}
          {protocols.find((p) => p.name === 'Unknown')!.share}% of transactions
          are unattributed. Unattributed transactions are excluded from named
          protocol totals.
        </div>
      </div>
    </section>
  );
  const stats = [
    {
      icon: Activity,
      title: 'Transactions',
      value: count.toLocaleString(),
      desc: 'Across the selected period',
    },
    {
      icon: ArrowUpRight,
      title: 'Transfer volume',
      value: usd(walletData.volume),
      desc: 'Gross incoming + outgoing value',
    },
    {
      icon: Wallet,
      title: 'Unique counterparties',
      value: walletData.counterparties.toLocaleString(),
      desc: 'Distinct interacting addresses',
    },
    {
      icon: Zap,
      title: 'Active days',
      value: `${active} / ${days}`,
      desc: `${Math.round((active / days) * 100)}% activity rate`,
    },
  ];
  return (
    <div className="app-shell">
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-inner">
            <a className="brand" href="/" aria-label="OnChain home">
              <Blocks size={23} />
              <span>OnChain</span>
              <span className="brand-divider" />
              <small>Wallet profiler</small>
            </a>
          </div>
        </header>
        <div className="page">
          <div className="page-title">
            <div>
              <h1>Wallet profiler</h1>
              <p>Understand a wallet through its behavior.</p>
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
            <Select
              value={period}
              onValueChange={(v) => {
                if (v && v !== period) {
                  setReady(false);
                  setServiceError('');
                  setPeriod(v);
                  setSelectedProtocol(null);
                  const nextUrl = new URL(window.location.href);
                  nextUrl.searchParams.set('address', address);
                  nextUrl.searchParams.set('period', v);
                  window.history.replaceState({}, '', nextUrl);
                }
              }}
            >
              <SelectTrigger
                aria-label="Analysis period"
                className="period-select"
              >
                <SelectValue>{`Last ${period} days`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {['30', '90', '180'].map((v) => (
                  <SelectItem key={v} value={v}>
                    Last {v} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button className="primary" type="submit">
              Analyze wallet
              <ArrowRight size={17} />
            </button>
          </form>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
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
              <p>Analysis period: {date(11 - days)} – {endDate}</p>
            </div>
            <button className="secondary export" onClick={exportCard}>
              <Download size={16} /> Export profile
            </button>
          </div>
          <section className="analysis-status" aria-label="Analysis provenance">
            <div>
              <span>Data source</span>
              <strong>{dataSource === 'nansen' ? 'Nansen API' : dataSource === 'etherscan' ? 'Etherscan API' : 'Analysis service'}</strong>
            </div>
            <div>
              <span>Profiles assessed</span>
              <strong>{profileResults.filter((profile) => profile.status !== 'NOT_ASSESSED').length} of {profileResults.length}</strong>
            </div>
            <div>
              <span>Records processed</span>
              <strong>{count.toLocaleString()}</strong>
            </div>
            <div>
              <span>Rule version</span>
              <strong>{ruleVersion}</strong>
            </div>
          </section>
          <section
            className="identity-card profile-feature"
            aria-labelledby="behavioral-profile-title"
          >
            <div className="profile-summary">
              <div className="identity-heading">
                Behavioral profile{' '}
                <span className="profile-period">{days}-day analysis</span>
              </div>
              <h2 id="behavioral-profile-title">{classification}</h2>
              <p className="profile-description">
                {profileDescriptions[classification]}
              </p>
              <div className="profile-matches" aria-label="Assigned profiles">
                {assignedProfiles.map((profile) => (
                  <span key={profile.name}>
                    {profile.name}{profile.score === null ? '' : ` · ${profile.score}/100`}
                  </span>
                ))}
                {!assignedProfiles.length && <span>No verified profile assignment</span>}
              </div>
            </div>
            <div className="profile-anomaly">
              <div className="score-row">
                <div>
                  <span>Behavioral anomaly</span>
                  <p>
                    <strong>{anomalyScore}</strong>
                    <span> / 100</span>
                  </p>
                </div>
                <span className="risk-label">{serverIndicators?.band ?? 'Unavailable'} deviation</span>
              </div>
              <div className="risk-track">
                <i style={{ left: anomalyScore + '%' }} />
              </div>
              <div className="scale">
                <span>Typical</span>
                <span>Unusual</span>
              </div>
              <button
                className="card-risk-summary"
                onClick={() => {
                  updateRoute('risk');
                  requestAnimationFrame(() =>
                    document.getElementById('wallet-details')?.scrollIntoView({
                      block: 'start',
                      behavior: 'smooth',
                    }),
                  );
                }}
              >
                <span>Behavioral risk</span>
                <b>{riskScore}/100 · {riskBand}</b>
                <ArrowRight size={14} />
              </button>
            </div>
            <dl className="profile-signals">
              <div>
                <dt>Active days</dt>
                <dd className="active-days-value">
                  {active} of {days}
                  <span>days</span>
                </dd>
              </div>
              <div>
                <dt>Protocols used</dt>
                <dd>
                  {
                    protocols.filter(
                      (protocol) =>
                        !['Unknown', 'No protocol'].includes(protocol.name) &&
                        protocol.share > 0,
                    ).length
                  }
                  <span>protocols</span>
                </dd>
              </div>
              <div>
                <dt>Transaction frequency</dt>
                <dd>
                  {(count / days).toFixed(1)}
                  <span>tx / day</span>
                </dd>
              </div>
            </dl>
            <div className="profile-action">
              <span>
                {assignedProfiles.length ? 'Based on the verified rules and evidence shown below.' : 'Classification requires verified actions and history; observed activity alone is not scored.'}
              </span>
              <button
                className="text-link"
                onClick={() => {
                  updateRoute('evidence');
                  requestAnimationFrame(() =>
                    document.getElementById('wallet-details')?.scrollIntoView({
                      behavior: window.matchMedia(
                        '(prefers-reduced-motion: reduce)',
                      ).matches
                        ? 'auto'
                        : 'smooth',
                      block: 'start',
                    }),
                  );
                }}
              >
                View supporting evidence <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <Tabs
            id="wallet-details"
            value={tab}
            onValueChange={(v) => {
              const nextTab = v as TabId;
              if (nextTab !== tab) updateRoute(nextTab);
            }}
          >
            <TabsList variant="line" className="main-tabs">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="balances">Balances</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="movements">Token movements</TabsTrigger>
              <TabsTrigger value="flows">Fund flows</TabsTrigger>
              <TabsTrigger value="protocols">Protocols used</TabsTrigger>
              <TabsTrigger value="risk">Risk indicators</TabsTrigger>
              <TabsTrigger value="evidence">Profile evidence</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="stats-grid">
                {stats.map((x) => (
                  <section className="stat" key={x.title}>
                    <div>
                      {x.title}
                      <x.icon size={17} />
                    </div>
                    <strong>{x.value}</strong>
                    <p>{x.desc}</p>
                  </section>
                ))}
              </div>
              <div className="main-grid">
                <div className="left-col">{activityChart}</div>
                <div className="right-col">{protocolPanel}</div>
              </div>
              {walletData.tradePerformance && (
                <section className="panel trade-performance">
                  <div className="panel-heading">
                    <div><h2>Trade performance</h2><p>Nansen trading summary for the selected period</p></div>
                  </div>
                  <dl>
                    <div><dt>Trades</dt><dd>{walletData.tradePerformance.tradedTimes.toLocaleString()}</dd></div>
                    <div><dt>Tokens traded</dt><dd>{walletData.tradePerformance.tradedTokenCount.toLocaleString()}</dd></div>
                    <div><dt>Realized PnL</dt><dd>{usd(walletData.tradePerformance.realizedPnlUsd)}</dd></div>
                    <div><dt>Win rate</dt><dd>{walletData.tradePerformance.winRate.toFixed(1)}%</dd></div>
                  </dl>
                </section>
              )}
              <BalancesPanel key={address + period} data={walletData} />
              {heatmap}
            </TabsContent>
            <TabsContent value="activity">
              {activityChart}
              {heatmap}
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
                <TransactionTable
                  key={address + period}
                  transactions={walletData.transactions}
                  onProtocol={setSelectedProtocol}
                />
              </section>
            </TabsContent>
            <TabsContent value="balances">
              <BalancesPanel key={address + period} data={walletData} />
            </TabsContent>
            <TabsContent value="movements">
              <MovementPanel
                key={address + period}
                movements={walletData.movements}
              />
            </TabsContent>
            <TabsContent value="flows">
              <FundFlows key={address + period} data={walletData} />
            </TabsContent>
            <TabsContent value="protocols">
              <div className="detail-grid">
                {protocolPanel}
                <section className="panel">
                  <h2>Interaction breakdown</h2>
                  <p className="detail-copy">
                    Compare protocol usage across exchanges, lending platforms,
                    staking services and marketplaces.
                  </p>
                  {namedProtocols.length ? namedProtocols.map((p) => (
                      <div className="breakdown" key={p.name}>
                        <div>
                          <b>{p.name}</b>
                          <span>{p.share}%</span>
                        </div>
                        <div>
                          <i
                            style={{
                              width: p.share + '%',
                              background: p.color,
                            }}
                          />
                        </div>
                      </div>
                    )) : (
                    <div className="protocol-empty compact">
                      <b>No protocol usage to compare</b>
                      <p>Only direct or unattributed activity was found.</p>
                    </div>
                  )}
                  <div className="provenance">
                    <Info size={18} /> Direct transfers are wallet activity, not
                    protocol usage. Unknown interactions stay unattributed.
                  </div>
                </section>
              </div>
              <section className="panel defi-positions">
                <div className="panel-heading">
                  <div><h2>Current DeFi positions</h2><p>Active Ethereum positions reported by Nansen</p></div>
                </div>
                {walletData.defiPositions.length ? (
                  <div className="defi-position-list">
                    {walletData.defiPositions.map((position) => (
                      <div key={`${position.chain}-${position.protocol}`}>
                        <div><b>{position.protocol}</b><span>{position.positionTypes.join(', ') || 'Position'}</span></div>
                        <strong>{usd(position.totalValue)}</strong>
                        <small>Assets {usd(position.totalAssets)} · Debts {usd(position.totalDebts)} · Rewards {usd(position.totalRewards)}</small>
                      </div>
                    ))}
                  </div>
                ) : <p className="detail-copy">{walletData.enrichmentCoverage.defiPositions ? 'No active Ethereum DeFi positions were returned.' : 'DeFi position data is unavailable for this analysis.'}</p>}
              </section>
            </TabsContent>
            <TabsContent value="risk">
              <section className="panel risk-panel">
                <div className="risk-overview">
                  <div>
                    <span>Behavioral risk score</span>
                    <strong>{riskScore}<small>/100</small></strong>
                  </div>
                  <span className={`risk-band risk-band-${riskBand.toLowerCase()}`}>
                    {riskBand} indicator level
                  </span>
                </div>
                <p className="detail-copy">
                  Calculated from the observable signals that could be checked
                  in this analysis period. Each supported signal has equal
                  weight under OWP rules v1.0.
                </p>
                <div className="risk-signal-list">
                  {riskSignals.map((signal) => (
                    <div className="risk-signal-row" key={signal.name}>
                      <span className={signal.detected ? 'signal-on' : 'signal-off'}>
                        {signal.detected ? 'Detected' : 'Not detected'}
                      </span>
                      <div>
                        <b>{signal.name}</b>
                        <p>{signal.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="provenance">
                  <Info size={18} /> Risky-address exposure was not checked
                  because no reliable label result is available. This score is
                  an analytical indicator for further review. It does not
                  establish money laundering, criminal activity,
                  creditworthiness, investment risk, or legal/compliance
                  status.
                </div>
              </section>
            </TabsContent>
            <TabsContent value="evidence">
              {evidence}
              <section className="panel rule-results">
                <div className="panel-heading">
                  <div>
                    <h2>Profile rule results</h2>
                    <p>Independent decisions under {ruleVersion} · {mappingVersion}</p>
                  </div>
                </div>
                {profileResults.map((profile) => {
                  return (
                    <div className="rule-result" key={profile.name}>
                      <div>
                        <b>{profile.name}</b>
                        <p>{profile.evidence}</p>
                        {!!profile.matchedRules.length && <p>Matched rules: {profile.matchedRules.map((rule) => `${rule.id} +${rule.points}`).join(', ')}</p>}
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
                  <div><dt>Source</dt><dd>{dataSource === 'nansen' ? 'Nansen API' : dataSource === 'etherscan' ? 'Etherscan API' : 'Analysis service'}</dd></div>
                  <div><dt>Mapping version</dt><dd>{mappingVersion}</dd></div>
                  <div><dt>Requested period</dt><dd>{date(11 - days)} – {endDate}</dd></div>
                  <div><dt>Profile assessability</dt><dd>{profileResults.filter((profile) => profile.status !== 'NOT_ASSESSED').length} of {profileResults.length} assessed</dd></div>
                  <div><dt>Processed records</dt><dd>{count.toLocaleString()} transactions</dd></div>
                  <div><dt>Protocol attribution</dt><dd>{identifiedProtocolShare.toFixed(1)}% identified</dd></div>
                  <div><dt>Historical balances</dt><dd>{walletData.enrichmentCoverage.historicalBalances ? `${walletData.historicalBalances.length.toLocaleString()} records` : 'Unavailable'}</dd></div>
                  <div><dt>Dedicated counterparties</dt><dd>{walletData.enrichmentCoverage.counterparties ? `${walletData.flows.length.toLocaleString()} returned` : 'Unavailable'}</dd></div>
                  <div><dt>Trade performance</dt><dd>{walletData.enrichmentCoverage.tradePerformance ? 'Available' : 'Unavailable'}</dd></div>
                  <div><dt>Current DeFi positions</dt><dd>{walletData.enrichmentCoverage.defiPositions ? `${walletData.defiPositions.length.toLocaleString()} returned` : 'Unavailable'}</dd></div>
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
                      Active Trader, Long-Term Holder, DeFi Participant, NFT
                      Trader, Staking Participant, and Dormant or New Wallet
                      are assessed independently. A
                      wallet may match several profiles. Read every result with
                      its decision status, score where assessable, and supporting evidence.
                    </p>
                  </div>
                  <div>
                    <h3>Behavioral anomaly score</h3>
                    <p>
                      Read this activity indicator alongside the supporting
                      evidence and selected time period. It is not a fraud,
                      sanction, credit, security or investment-risk rating.
                    </p>
                  </div>
                </div>
              </section>
            </TabsContent>
          </Tabs>
          <footer className="footer">
            <span>
              <Blocks size={14} /> OnChain Wallet Profiler
            </span>
            <span>Ethereum wallet analytics</span>
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
            Transactions for this wallet in the last {days} days. Expand a
            transaction to see every token movement and address.
          </DialogDescription>
          <TransactionTable
            key={address + period + selectedProtocol}
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
