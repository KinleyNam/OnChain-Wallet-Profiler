import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { shortAddress, usd, type WalletData, type ProtocolUsage } from '@/lib/wallet-data';
import type { ProfileResult } from '../server/analysis';

export function MetricCards({ items }: { items: Array<{ label: string; value: string; note?: string; tone?: string }> }) {
  return <div className="design-metrics">{items.map((item) => <div className={`design-metric ${item.tone ?? ''}`} key={item.label}>
    <span>{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}
  </div>)}</div>;
}

export function OverviewProfile({ profiles, primary }: { profiles: ProfileResult[]; primary: string }) {
  const assigned = profiles.filter((profile) => profile.assigned);
  const segmentSize = profiles.length ? 360 / profiles.length : 360;
  const segments = profiles.map((profile, index) => {
    const start = index * segmentSize + 1;
    const end = (index + 1) * segmentSize - 2;
    const color = profile.assigned ? '#8d5cf9' : profile.status === 'NOT_ASSESSED' ? '#2c2146' : '#5d4a8b';
    return `${color} ${start}deg ${end}deg`;
  }).join(', ');
  return <section className="design-card overview-profile-card">
    <div className="design-card-title">Behavioral profile <span>Five independent rule decisions</span></div>
    <div className="overview-profile-body">
      <div className="profile-donut" role="img" aria-label={`${assigned.length} of ${profiles.length} profiles matched. Each segment represents one profile.`} style={{ background: profiles.length ? `conic-gradient(${segments})` : 'var(--accent-soft)' }}>
        <div><strong>{assigned.length}</strong><span>of {profiles.length} matched</span></div>
      </div>
      <div className="profile-decision-list">
        <h2>{primary}</h2>
        {profiles.map((profile) => <div key={profile.name}>
          <span className={`decision-dot ${profile.assigned ? 'assigned' : profile.status === 'NOT_ASSESSED' ? 'unassessed' : ''}`} />
          <span>{profile.name}</span>
          <b>{profile.status === 'NOT_ASSESSED' ? 'Not assessed' : profile.assigned ? 'Matched' : 'Not matched'}</b>
        </div>)}
      </div>
    </div>
  </section>;
}

export function AllocationCard({ data }: { data: WalletData }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const sorted = [...data.holdings].filter((holding) => holding.value > 0).sort((a, b) => b.value - a.value);
  const total = sorted.reduce((sum, holding) => sum + holding.value, 0);
  const slices = sorted.slice(0, 8);
  if (sorted.length > 8) slices.push({
    tokenAddress: 'other', symbol: 'Other assets', name: 'Other assets', price: 0, balance: 0,
    value: sorted.slice(8).reduce((sum, holding) => sum + holding.value, 0), color: '#888094',
  });
  const selected = slices.find((holding) => holding.tokenAddress === selectedKey);
  const toggle = (key: string) => setSelectedKey((current) => current === key ? null : key);
  return <section className="design-card allocation-card">
    <div className="design-card-title">Asset allocation <span>USD · {new Date(data.asOf).toLocaleDateString('en-US', { timeZone: 'UTC' })} UTC</span></div>
    {slices.length ? <>
      <div className="allocation-plot">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="symbol" innerRadius="68%" outerRadius="94%"
              stroke="var(--surface)" isAnimationActive={false}
              onClick={(_, index) => toggle(slices[index].tokenAddress)}>
              {slices.map((holding) => <Cell key={holding.tokenAddress} fill={holding.color} opacity={!selected || selected === holding ? 1 : 0.4} />)}
            </Pie>
            <Tooltip formatter={(value) => usd(Number(value))} contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)' }} itemStyle={{ color: 'var(--foreground)' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="allocation-center" aria-live="polite"><span>{selected?.symbol ?? 'Total valued assets'}</span><strong>{usd(selected?.value ?? total)}</strong></div>
      </div>
      <div className="allocation-legend">{slices.map((holding) => <button type="button" key={holding.tokenAddress} aria-pressed={selected === holding}
        title={`${holding.symbol}: ${usd(holding.value)}`} onClick={() => toggle(holding.tokenAddress)}>
        <span><i style={{ background: holding.color }} />{holding.symbol}</span><b>{((holding.value / total) * 100).toFixed(1)}%</b>
      </button>)}</div>
    </> : <p className="design-empty">No priced holdings were available for this snapshot.</p>}
  </section>;
}

type FlowBar = { label: string; incoming: number; outgoing: number };
export function DualFlowChart({ title, subtitle, items, unavailable = false }: {
  title: string; subtitle: string; items: FlowBar[]; unavailable?: boolean;
}) {
  const ranked = [...items].sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing)).slice(0, 8);
  const max = Math.max(1, ...ranked.map((item) => Math.max(item.incoming, item.outgoing)));
  return <section className="design-card dual-flow-card">
    <div className="design-card-title">{title}<span>{subtitle} · available history</span></div>
    {unavailable ? <p className="design-empty"><Info size={16} /> USD prices were unavailable for these movements.</p> : ranked.length ? <>
      <div className="flow-chart-legend"><span><i className="legend-in" /> Incoming</span><span><i className="legend-out" /> Outgoing</span></div>
      <div className="flow-chart-axis"><span>Amount (USD)</span><span>{usd(0)}</span><span>{usd(max / 2)}</span><span>{usd(max)}</span></div>
      <div className="dual-flow-rows">{ranked.map((item) => <div className="dual-flow-row" key={item.label}>
        <span title={item.label}>{item.label}</span>
        <div tabIndex={0} className="flow-bar-detail" aria-label={`${item.label}: incoming ${usd(item.incoming)}, outgoing ${usd(item.outgoing)}`}>
          <i className="flow-in" style={{ width: `${(item.incoming / max) * 100}%` }} />
          <i className="flow-out" style={{ width: `${(item.outgoing / max) * 100}%` }} />
          <span className="flow-tooltip" aria-hidden="true">Incoming {usd(item.incoming)} · Outgoing {usd(item.outgoing)}</span>
        </div>
      </div>)}</div>
    </> : <p className="design-empty">No valued movements were returned.</p>}
  </section>;
}

export function MovementSummary({ data, section = 'charts' }: { data: WalletData; section?: 'charts' | 'totals' }) {
  const byToken = new Map<string, FlowBar>();
  for (const movement of data.movements) {
    if (movement.usdAvailable === false || !Number.isFinite(movement.usd)) continue;
    const row = byToken.get(movement.token) ?? { label: movement.token, incoming: 0, outgoing: 0 };
    if (movement.direction === 'in') row.incoming += movement.usd;
    else row.outgoing += movement.usd;
    byToken.set(movement.token, row);
  }
  const items = [...byToken.values()].sort((a, b) => b.incoming + b.outgoing - a.incoming - a.outgoing);
  const totalIn = items.reduce((sum, item) => sum + item.incoming, 0);
  const totalOut = items.reduce((sum, item) => sum + item.outgoing, 0);
  const pricedTotals = data.usdValuation === 'unavailable' ? 'Unavailable' : data.usdValuation === 'partial' ? 'Priced records only' : 'Priced movements across available history';
  if (section === 'charts') return <div className="design-split">
      <AllocationCard data={data} />
      <DualFlowChart title="Token movement" subtitle="Priced inflow and outflow by asset" items={items} unavailable={data.usdValuation === 'unavailable'} />
    </div>;
  return <section className="design-card movement-summary">
      <div className="design-card-title">Movement summary <span>{pricedTotals}</span></div>
      <div className="movement-totals"><span>Incoming <b>{data.usdValuation === 'unavailable' ? 'Unavailable' : usd(totalIn)}</b></span><span>Outgoing <b>{data.usdValuation === 'unavailable' ? 'Unavailable' : usd(totalOut)}</b></span><span>Net <b>{data.usdValuation === 'unavailable' ? 'Unavailable' : usd(totalIn - totalOut)}</b></span></div>
      <div className="movement-summary-table"><div className="summary-head"><span>Asset</span><span>Incoming</span><span>Outgoing</span><span>Net</span></div>
        {items.slice(0, 8).map((item) => <div key={item.label}><b>{item.label}</b><span>{usd(item.incoming)}</span><span>{usd(item.outgoing)}</span><span>{usd(item.incoming - item.outgoing)}</span></div>)}
      </div>
    </section>;
}

export function FlowOverview({ data }: { data: WalletData }) {
  const rows = data.flows.map((flow) => ({ label: flow.label || shortAddress(flow.name), incoming: flow.incoming, outgoing: flow.outgoing }));
  const incoming = rows.reduce((sum, row) => sum + row.incoming, 0);
  const outgoing = rows.reduce((sum, row) => sum + row.outgoing, 0);
  const max = Math.max(0, ...rows.map((row) => row.incoming + row.outgoing));
  const topShare = incoming + outgoing ? (max / (incoming + outgoing)) * 100 : 0;
  return <>
    <MetricCards items={[
      { label: 'Total inflow', value: rows.length ? usd(incoming) : data.usdValuation === 'unavailable' ? 'Unavailable' : usd(data.incoming), tone: 'positive', note: 'Received' },
      { label: 'Total outflow', value: rows.length ? usd(outgoing) : data.usdValuation === 'unavailable' ? 'Unavailable' : usd(data.outgoing), tone: 'negative', note: 'Sent' },
      { label: 'Net flow', value: rows.length ? usd(incoming - outgoing) : data.usdValuation === 'unavailable' ? 'Unavailable' : usd(data.incoming - data.outgoing), note: 'Inflow minus outflow' },
      { label: 'Top counterparty share', value: incoming + outgoing ? `${topShare.toFixed(1)}%` : 'Unavailable', note: rows[0]?.label ?? 'No counterparty data' },
    ]} />
    <DualFlowChart title="Flow by counterparty" subtitle="Incoming and outgoing USD totals" items={rows} unavailable={!rows.length && data.usdValuation === 'unavailable'} />
  </>;
}

export function ProtocolOverview({ protocols, data }: { protocols: ProtocolUsage[]; data: WalletData }) {
  const named = protocols.filter((protocol) => protocol.count > 0 && !['Unknown', 'No protocol'].includes(protocol.name));
  const mostUsed = [...named].sort((a, b) => b.count - a.count)[0];
  const interactionCount = named.reduce((sum, protocol) => sum + protocol.count, 0);
  const byProtocol = new Map<string, FlowBar>();
  for (const movement of data.movements) {
    if (movement.usdAvailable === false || !Number.isFinite(movement.usd) || !named.some((item) => item.name === movement.protocol)) continue;
    const row = byProtocol.get(movement.protocol) ?? { label: movement.protocol, incoming: 0, outgoing: 0 };
    if (movement.direction === 'in') row.incoming += movement.usd;
    else row.outgoing += movement.usd;
    byProtocol.set(movement.protocol, row);
  }
  const valued = [...byProtocol.values()];
  const volume = valued.reduce((sum, row) => sum + row.incoming + row.outgoing, 0);
  return <>
    <MetricCards items={[
      { label: 'Protocols used', value: named.length.toLocaleString() },
      { label: 'Priced movement volume', value: data.usdValuation === 'unavailable' || !valued.length ? 'Unavailable' : usd(volume), note: 'Protocol attributed transfers' },
      { label: 'Interactions', value: interactionCount.toLocaleString() },
      { label: 'Most used', value: mostUsed?.name ?? 'None identified' },
    ]} />
    <DualFlowChart title="Protocol movements" subtitle="Priced transfers attributed to named protocols" items={valued} unavailable={data.usdValuation === 'unavailable'} />
  </>;
}

export function ActivitySummary({ data, activeDays }: { data: WalletData; activeDays: number }) {
  const verified = data.transactions.filter((transaction) => transaction.successful !== undefined).length;
  const count = data.daily.reduce((sum, total) => sum + total, 0);
  return <MetricCards items={[
    { label: 'Transactions', value: count.toLocaleString() },
    { label: 'Active days', value: activeDays.toLocaleString() },
    { label: 'Average per active day', value: activeDays ? (count / activeDays).toFixed(1) : '0.0' },
    { label: 'Receipt status known', value: data.transactions.length ? `${Math.round((verified / data.transactions.length) * 100)}%` : 'Unavailable', note: 'Among loaded transactions' },
  ]} />;
}

export function RiskOverview({ score, band, signals }: { score: number; band: string; signals: Array<{ name: string; detected: boolean; value: string }> }) {
  const triggered = signals.filter((signal) => signal.detected);
  const passed = signals.filter((signal) => !signal.detected);
  return <>
    <div className="design-split risk-split">
      <section className={`design-card risk-gauge-card risk-tone-${band.toLowerCase()}`}><div className="design-card-title">Activity indicator score <span>Share of triggered signals · available history</span></div>
        <div className="risk-gauge" title={`${triggered.length} of ${signals.length} signals triggered`} style={{ background: `conic-gradient(var(--risk-color) 0 ${score}%, #302446 ${score}% 100%)` }}><div><strong>{score}/100</strong><span>{band}</span></div></div>
        <p>{triggered.length} of {signals.length} indicators triggered</p>
      </section>
      <section className={`design-card risk-exposure-card risk-tone-${band.toLowerCase()}`}><div className="design-card-title">What this score covers <span>Observed behavioral patterns only</span></div>
        <p>The indicator combines timing, movement, concentration, and repeated activity. It does not check address sanctions, fraud, or legal status.</p>
        <div className="risk-exposure-scale"><i style={{ width: `${score}%` }} /></div>
        <div className="risk-exposure-labels"><span>Typical</span><span>Unusual</span></div>
      </section>
    </div>
    <section className="design-card signal-card"><div className="design-card-title">Triggered indicators <span>Patterns detected in this wallet&apos;s available history</span></div>
      <div className="signal-grid">{triggered.length ? triggered.map((signal) => <article key={signal.name}><ArrowUpRight size={17} /><div><b>{signal.name}</b><p>{signal.value}</p></div></article>) : <p>No indicators were triggered.</p>}</div>
    </section>
    <section className="design-card signal-card passed"><div className="design-card-title">Other checks <span>Signals below their detection thresholds</span></div>
      <div className="signal-grid">{passed.map((signal) => <article key={signal.name}><ArrowDownLeft size={17} /><div><b>{signal.name}</b><p>{signal.value}</p></div></article>)}</div>
    </section>
  </>;
}
