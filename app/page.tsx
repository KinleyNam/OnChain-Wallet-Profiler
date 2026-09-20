import { useEffect, useMemo, useState } from 'react';
import { buildWalletData, exampleWallets, usd } from '@/lib/wallet-data';
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

const example = exampleWallets[0].address;
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
function date(day: number) {
  return new Date(Date.UTC(2026, 8, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
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
    : '90';
  const [input, setInput] = useState(initialAddress),
    [address, setAddress] = useState(initialAddress),
    [period, setPeriod] = useState(initialPeriod),
    [tab, setTab] = useState<TabId>(() => tabFromPath()),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
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
        setAddress(restoredAddress);
        setInput(restoredAddress);
      }
      if (['30', '90', '180'].includes(restoredPeriod ?? '')) {
        setPeriod(restoredPeriod!);
      }
      setSelectedProtocol(null);
    }
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);
  const walletData = useMemo(
    () => buildWalletData(address, Number(period)),
    [address, period],
  );
  const protocols = walletData.protocols;
  const days = Number(period),
    s = address
      .toLowerCase()
      .split('')
      .reduce((n, c) => n + c.charCodeAt(0), 0),
    daily = walletData.daily,
    count = daily.reduce((a, b) => a + b, 0),
    active = daily.filter((n) => n > 0).length,
    anomalyScore = 18 + (s % 22);
  const identifiedProtocolShare = protocols
    .filter((p) => !['Unknown', 'No protocol'].includes(p.name))
    .reduce((sum, p) => sum + p.share, 0);
  const protocolCount = (name: string) =>
    protocols.find((protocol) => protocol.name === name)?.count ?? 0;
  const defiCount = ['Uniswap', 'Aave', 'Lido'].reduce(
    (sum, name) => sum + protocolCount(name),
    0,
  );
  const defiShare = count ? (defiCount / count) * 100 : 0;
  const defiProtocolCount = ['Uniswap', 'Aave', 'Lido'].filter(
    (name) => protocolCount(name) > 0,
  ).length;
  const nftTradeCount = protocolCount('OpenSea') + protocolCount('Blur');
  const nftTradeShare = count ? (nftTradeCount / count) * 100 : 0;
  const nftMarketplaceCount = ['OpenSea', 'Blur'].filter(
    (name) => protocolCount(name) > 0,
  ).length;
  const stakingCount = protocolCount('Lido');
  const stakingShare = count ? (stakingCount / count) * 100 : 0;
  const isNewWallet = walletData.walletAgeDays > 0 && walletData.walletAgeDays <= 30;
  const isDormantWallet =
    walletData.daysSinceLastActivity !== null &&
    walletData.daysSinceLastActivity >= 30;
  const profileResults = [
    {
      name: 'Active trader',
      score: Math.min(
        100,
        Math.round((count / days / 12) * 70 + (active / days) * 30),
      ),
      threshold: 60,
      evidence: `${(count / days).toFixed(1)} transactions per day and ${Math.round((active / days) * 100)}% active days`,
      confidence: 'High',
    },
    {
      name: 'DeFi participant',
      score: Math.min(
        100,
        Math.round(defiShare + defiProtocolCount * 8),
      ),
      threshold: 60,
      evidence: `${defiShare.toFixed(1)}% of activity across ${defiProtocolCount} DeFi protocols`,
      confidence: 'High',
    },
    {
      name: 'Long-term holder',
      score:
        walletData.walletAgeDays < 90
          ? null
          : Math.max(
              0,
              Math.round(
                100 -
                  (walletData.outgoing /
                    Math.max(
                      1,
                      walletData.totalBalance + walletData.outgoing,
                    )) *
                    100,
              ),
            ),
      threshold: 60,
      evidence:
        walletData.walletAgeDays < 90
          ? 'Requires at least 90 days of usable history'
          : `${walletData.walletAgeDays} days of history with ${usd(walletData.outgoing)} outgoing volume in this period`,
      confidence: walletData.walletAgeDays >= 90 ? 'Moderate' : 'Unavailable',
    },
    {
      name: 'NFT trader',
      score: Math.min(
        100,
        Math.round(nftTradeShare * 2 + nftMarketplaceCount * 15),
      ),
      threshold: 60,
      evidence: `${nftTradeCount} marketplace trades across ${nftMarketplaceCount} marketplaces`,
      confidence: 'Moderate',
    },
    {
      name: 'Staking participant',
      score: Math.min(
        100,
        Math.round(stakingShare * 2 + (stakingCount > 0 ? 20 : 0)),
      ),
      threshold: 60,
      evidence: `${stakingCount} Lido staking interactions representing ${stakingShare.toFixed(1)}% of activity`,
      confidence: 'High',
    },
    {
      name: 'Dormant or new wallet',
      score:
        walletData.walletAgeDays === 0
          ? null
          : isNewWallet || isDormantWallet
            ? 100
            : 0,
      threshold: 60,
      evidence: isNewWallet
        ? `First activity was ${walletData.walletAgeDays} days ago`
        : isDormantWallet
          ? `No activity for ${walletData.daysSinceLastActivity} days`
          : `${walletData.walletAgeDays} days of history; last active ${walletData.daysSinceLastActivity} days ago`,
      confidence: walletData.walletAgeDays === 0 ? 'Unavailable' : 'High',
    },
  ];
  const assignedProfiles = profileResults
    .filter((profile) => profile.score !== null && profile.score >= profile.threshold)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const classification =
    assignedProfiles.find((profile) => profile.name === walletData.profileHint)
      ?.name ??
    assignedProfiles.find((profile) => profile.name === 'Dormant or new wallet')
      ?.name ??
    assignedProfiles[0]?.name ??
    'No profile assigned';
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
      isNewWallet
        ? 'A recently created wallet with limited historical activity.'
        : 'A previously active wallet with no recent transactions.',
    'No profile assigned':
      'No profile reached its assignment threshold for this period.',
  };
  const sortedTimes = walletData.transactions
    .map((transaction) => Date.parse(transaction.timestamp))
    .sort((a, b) => a - b);
  let maxTenMinuteBurst = 0;
  for (let left = 0, right = 0; right < sortedTimes.length; right++) {
    while (sortedTimes[right] - sortedTimes[left] > 10 * 60 * 1000) left++;
    maxTenMinuteBurst = Math.max(maxTenMinuteBurst, right - left + 1);
  }
  const flowTotal = walletData.flows.reduce(
    (sum, flow) => sum + flow.incoming + flow.outgoing,
    0,
  );
  const counterpartyConcentration = flowTotal
    ? Math.max(
        ...walletData.flows.map((flow) => flow.incoming + flow.outgoing),
      ) / flowTotal
    : 0;
  const dailyVolumes = walletData.transactions.reduce<Record<string, number>>(
    (totals, transaction) => {
      const day = transaction.timestamp.slice(0, 10);
      totals[day] = (totals[day] ?? 0) + transaction.value;
      return totals;
    },
    {},
  );
  const volumeValues = Object.values(dailyVolumes);
  const averageDailyVolume = volumeValues.length
    ? volumeValues.reduce((sum, value) => sum + value, 0) / volumeValues.length
    : 0;
  const volumeSpikeRatio = averageDailyVolume
    ? Math.max(...volumeValues) / averageDailyVolume
    : 0;
  const repeatedMinuteShare = count
    ? Math.max(
        ...Object.values(
          walletData.transactions.reduce<Record<string, number>>(
            (totals, transaction) => {
              const minute = transaction.timestamp.slice(14, 16);
              totals[minute] = (totals[minute] ?? 0) + 1;
              return totals;
            },
            {},
          ),
        ),
      ) / count
    : 0;
  let rapidMovementCount = 0;
  const lastIncomingByToken = new Map<string, number>();
  [...walletData.movements]
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .forEach((movement) => {
      const movementTime = Date.parse(movement.timestamp);
      if (movement.direction === 'in') {
        lastIncomingByToken.set(movement.token, movementTime);
      } else {
        const lastIncoming = lastIncomingByToken.get(movement.token);
        if (
          lastIncoming !== undefined &&
          movementTime - lastIncoming <= 10 * 60 * 1000
        ) {
          rapidMovementCount++;
        }
      }
    });
  const transactionTypeCounts = walletData.transactions.reduce<
    Record<string, number>
  >((totals, transaction) => {
    totals[transaction.type] = (totals[transaction.type] ?? 0) + 1;
    return totals;
  }, {});
  const mostRepeatedType = Object.entries(transactionTypeCounts).sort(
    (a, b) => b[1] - a[1],
  )[0] ?? ['No activity', 0];
  const repeatedTypeShare = count ? mostRepeatedType[1] / count : 0;
  const riskSignals = [
    {
      name: 'Transaction burst',
      detected: maxTenMinuteBurst >= 8,
      value: `${maxTenMinuteBurst} transactions in the busiest 10-minute window`,
    },
    {
      name: 'Rapid movement of received funds',
      detected: rapidMovementCount >= 3,
      value: `${rapidMovementCount} outgoing transfers within 10 minutes of receiving the same asset`,
    },
    {
      name: 'Counterparty concentration',
      detected: counterpartyConcentration >= 0.65,
      value: `${Math.round(counterpartyConcentration * 100)}% linked to the largest counterparty group`,
    },
    {
      name: 'Daily volume increase',
      detected: volumeSpikeRatio >= 3,
      value: `${volumeSpikeRatio.toFixed(1)}× the average daily volume at the peak`,
    },
    {
      name: 'Repetitive transaction pattern',
      detected: repeatedTypeShare >= 0.7,
      value: `${mostRepeatedType[0]} represents ${Math.round(repeatedTypeShare * 100)}% of transactions`,
    },
    {
      name: 'Repeated transaction timing',
      detected: repeatedMinuteShare >= 0.25,
      value: `${Math.round(repeatedMinuteShare * 100)}% share at the most repeated minute`,
    },
  ];
  const riskScore = Math.round(
    (riskSignals.filter((signal) => signal.detected).length / riskSignals.length) *
      100,
  );
  const riskBand = riskScore >= 60 ? 'High' : riskScore >= 30 ? 'Moderate' : 'Low';
  const chart = Array.from({ length: 15 }, (_, i) => ({
    day: date(11 - days + Math.floor((i * days) / 15)),
    transactions: daily
      .slice(Math.floor((i * days) / 15), Math.floor(((i + 1) * days) / 15))
      .reduce((a, b) => a + b, 0),
  }));
  function analyze(value = input) {
    const nextAddress = value.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(nextAddress)) {
      setError(
        'Enter a valid Ethereum address: 0x followed by 40 hexadecimal characters.',
      );
      return;
    }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setAddress(nextAddress);
      setInput(nextAddress);
      const nextUrl = new URL(window.location.href);
      nextUrl.pathname = `/profiler/${tabRoutes.overview}`;
      nextUrl.searchParams.set('address', nextAddress);
      nextUrl.searchParams.set('period', period);
      window.history.replaceState({}, '', nextUrl);
      setLoading(false);
      setTab('overview');
      setSelectedProtocol(null);
    }, 450);
  }
  function exportCard() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            address,
            analysisPeriodDays: days,
            asOf: '2026-09-10',
            profiles: assignedProfiles.map((profile) => profile.name),
            profileRuleResults: profileResults,
            transactions: count,
            activeDays: active,
            behavioralAnomaly: anomalyScore,
            riskIndicators: { score: riskScore, band: riskBand, signals: riskSignals },
            provenance: {
              dataSource: 'Nansen API',
              coverage: 'Complete requested period',
              ruleVersion: 'OWP rules v1.0',
              generatedAt: '2026-09-10T23:59:59Z',
            },
            protocols,
            schemaVersion: '1.4',
            holdings: walletData.holdings,
            totalBalanceUSD: walletData.totalBalance,
            transactionHistory: walletData.transactions,
            tokenMovements: walletData.movements,
            fundFlows: {
              incomingUSD: walletData.incoming,
              outgoingUSD: walletData.outgoing,
              counterparties: walletData.flows,
            },
            limitations:
              'Not a fraud, sanction, credit, security or investment-risk rating.',
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'onchain-wallet-profile.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const protocolPanel = (
    <section className="panel protocols">
      <div className="panel-heading">
        <div>
          <h2>Protocols used</h2>
          <p>Select a protocol to inspect its transactions</p>
        </div>
      </div>
      <div className="stackbar">
        {protocols
          .filter((p) => p.count > 0)
          .map((p) => (
            <span
              key={p.name}
              style={{ width: p.share + '%', background: p.color }}
            />
          ))}
      </div>
      {protocols
        .filter((p) => p.count > 0)
        .map((p) => (
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
                    `${date(11 - days + i)}, 2026: ${value} transactions in the selected analysis period.`,
                  )
                }
              />
            );
          })}
        </div>
      </div>
      <div className="heat-footer">
        <span>{date(11 - days)}</span>
        <span>Sep 10, 2026</span>
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
          'Trading frequency',
          `${count} transactions across ${active} active days`,
          'High confidence',
        ],
        [
          'Protocol coverage',
          `${protocols
            .filter((p) => !['Unknown', 'No protocol'].includes(p.name))
            .reduce((sum, p) => sum + p.share, 0)
            .toFixed(1)}% attributed to identified protocols`,
          'High confidence',
        ],
        [
          'Counterparties',
          `${walletData.counterparties} distinct counterparties across the selected period`,
          'Moderate confidence',
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
          Analysis ends Sep 10, 2026.{' '}
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
                if (v) {
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
            <button className="primary" disabled={loading} type="submit">
              {loading ? 'Analyzing…' : 'Analyze wallet'}
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
              <p>Analysis period: {date(11 - days)} – Sep 10, 2026</p>
            </div>
            <button className="secondary export" onClick={exportCard}>
              <Download size={16} /> Export profile
            </button>
          </div>
          <section className="analysis-status" aria-label="Analysis provenance">
            <div>
              <span>Data source</span>
              <strong>Nansen API</strong>
            </div>
            <div>
              <span>Coverage</span>
              <strong>Complete requested period</strong>
            </div>
            <div>
              <span>Records processed</span>
              <strong>{count.toLocaleString()}</strong>
            </div>
            <div>
              <span>Rule version</span>
              <strong>OWP rules v1.0</strong>
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
                    {profile.name} · {profile.score}/100
                  </span>
                ))}
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
                <span className="risk-label">Low deviation</span>
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
                <dt>Trading frequency</dt>
                <dd>
                  {(count / days).toFixed(1)}
                  <span>tx / day</span>
                </dd>
              </div>
            </dl>
            <div className="profile-action">
              <span>
                Based on transaction frequency, active days and protocol usage.
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
              <BalancesPanel data={walletData} />
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
              <BalancesPanel data={walletData} />
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
                  {protocols
                    .filter((p) => p.count > 0)
                    .map((p) => (
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
                    ))}
                  <div className="provenance">
                    <Info size={18} /> Unknown interactions stay unattributed;
                    they are not automatically treated as suspicious.
                  </div>
                </section>
              </div>
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
                    <p>Independent profile matches under OWP rules v1.0</p>
                  </div>
                </div>
                {profileResults.map((profile) => {
                  const assigned =
                    profile.score !== null && profile.score >= profile.threshold;
                  return (
                    <div className="rule-result" key={profile.name}>
                      <div>
                        <b>{profile.name}</b>
                        <p>{profile.evidence}</p>
                      </div>
                      <span>
                        {profile.score === null
                          ? 'Could not assess'
                          : `${profile.score}/100 · ${assigned ? 'Assigned' : `Below ${profile.threshold}`} · ${profile.confidence} confidence`}
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
                  <div><dt>Source</dt><dd>Nansen API</dd></div>
                  <div><dt>Requested period</dt><dd>{date(11 - days)} – Sep 10, 2026</dd></div>
                  <div><dt>Coverage status</dt><dd>Complete requested period</dd></div>
                  <div><dt>Processed records</dt><dd>{count.toLocaleString()} transactions</dd></div>
                  <div><dt>Protocol attribution</dt><dd>{identifiedProtocolShare.toFixed(1)}% identified</dd></div>
                  <div><dt>Generated</dt><dd>Sep 10, 2026 at 23:59 UTC</dd></div>
                </dl>
                <div className="provenance">
                  <Info size={18} /> API limits, delayed records, missing pages,
                  or incomplete responses would appear here and final scores
                  would be withheld when essential data is unavailable.
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
                      its score, threshold, confidence and supporting evidence.
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
