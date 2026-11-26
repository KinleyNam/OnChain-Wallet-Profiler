import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  quantity,
  relativeTime,
  shortAddress,
  timestamp,
  usd,
  type Movement,
  type Transaction,
  type WalletData,
} from '@/lib/wallet-data';
import './wallet-panels.css';
import { AllocationCard, MetricCards } from './dashboard-views';

const PAGE_SIZE = 10;

function LedgerSearch({ label, query, onChange }: { label: string; query: string; onChange: (query: string) => void }) {
  return <input className="ledger-search" type="search" aria-label={label} placeholder={label}
    value={query} onChange={(event) => onChange(event.target.value)} />;
}

function matchesSearch(query: string, ...fields: Array<string | undefined | null>) {
  return fields.some((field) => field?.toLowerCase().includes(query));
}

const holdingColumns = [
  ['Asset', 'symbol'], ['Balance', 'balance'], ['Price', 'price'],
  ['Value', 'value'], ['Allocation', 'allocation'],
] as const;
type HoldingSort = (typeof holdingColumns)[number][1];

function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="ledger-pagination">
      <span aria-live="polite">
        {total
          ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}`
          : 'No records'}
      </span>
      <div>
        <button
          type="button"
          className="secondary"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          Page {page + 1} of {pages}
        </span>
        <button
          type="button"
          className="secondary"
          aria-label="Next page"
          disabled={page + 1 >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function BalancesPanel({ data }: { data: WalletData }) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ column: HoldingSort; ascending: boolean }>({ column: 'value', ascending: false });
  const holdings = useMemo(() => {
    const column = sort.column === 'allocation' ? 'value' : sort.column;
    return data.holdings.filter((holding) => matchesSearch(query.trim().toLowerCase(), holding.symbol, holding.name, holding.tokenAddress))
      .sort((a, b) => {
        const comparison = column === 'symbol' ? a.symbol.localeCompare(b.symbol) : a[column] - b[column];
        return (sort.ascending ? comparison : -comparison) || a.symbol.localeCompare(b.symbol);
      });
  }, [data.holdings, query, sort]);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(holdings.length / PAGE_SIZE) - 1));
  const stablecoinValue = data.holdings.filter((holding) => ['USDC', 'USDT', 'DAI', 'USDS'].includes(holding.symbol.toUpperCase())).reduce((total, holding) => total + holding.value, 0);

  return (
    <div className="balances-view">
      <MetricCards items={[
        { label: 'Total balance', value: usd(data.totalBalance), note: 'Current Ethereum assets' },
        { label: 'Tokens held', value: data.holdings.length.toLocaleString(), note: 'ETH and ERC-20' },
        { label: 'Stablecoin share', value: data.totalBalance ? `${(stablecoinValue / data.totalBalance * 100).toFixed(1)}%` : 'Unavailable', note: 'USDC, USDT, DAI, USDS' },
        { label: 'History records', value: data.historicalBalances.length.toLocaleString(), note: 'Balance snapshots available' },
      ]} />
      <div className="design-split balance-split">
      <AllocationCard data={data} />
    <section className="panel holdings-panel">
      <div className="panel-heading">
        <div>
          <h2>Assets on Ethereum</h2>
          <p>ETH and ERC-20 tokens held on Ethereum · as of {new Date(data.asOf).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</p>
        </div>
        <span className="holdings-count">{holdings.length.toLocaleString('en-US')} assets</span>
      </div>
      <div className="ledger-toolbar"><LedgerSearch label="Search assets" query={query} onChange={(value) => { setQuery(value); setPage(0); }} /></div>
      <Table className="ledger-table">
        <caption className="sr-only">
          Token balances and allocation at the snapshot date
        </caption>
        <TableHeader>
          <TableRow>
            {holdingColumns.map(([label, column]) => (
              <TableHead key={column} aria-sort={sort.column === column ? (sort.ascending ? 'ascending' : 'descending') : undefined}>
                <button className="ledger-sort" type="button" onClick={() => {
                  setSort({ column, ascending: sort.column === column ? !sort.ascending : column === 'symbol' });
                  setPage(0);
                }}>{label} <span aria-hidden="true">{sort.column === column ? (sort.ascending ? '↑' : '↓') : '↕'}</span></button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {holdings.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((h) => (
            <TableRow key={h.tokenAddress}>
              <TableCell>
                <div className="asset-name">
                  <span className="asset-mark" style={{ borderColor: h.color }}>
                    {h.symbol.slice(0, 1)}
                  </span>
                  <div>
                    <b>{h.symbol}</b>
                    <small>{h.name}</small>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                {quantity(h.balance)} {h.symbol}
              </TableCell>
              <TableCell>{usd(h.price)}</TableCell>
              <TableCell>
                <b>{usd(h.value)}</b>
              </TableCell>
              <TableCell>
                {(data.totalBalance ? (h.value / data.totalBalance) * 100 : 0).toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
          {!holdings.length && <TableRow><TableCell colSpan={5} className="ledger-empty">No assets found.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <Pager page={currentPage} total={holdings.length} onChange={setPage} />
    </section>
      </div>
    </div>
  );
}

export function TransactionTable({
  transactions,
  onProtocol,
}: {
  transactions: Transaction[];
  onProtocol?: (name: string) => void;
}) {
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const filtered = useMemo(() => transactions.filter(
    (t) => (type === 'all' || t.type === type) &&
      matchesSearch(query.trim().toLowerCase(), t.hash, t.type, t.protocol, t.fromAddress, t.toAddress),
  ).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [transactions, type, query]);
  const types = [...new Set(transactions.map((t) => t.type))].sort();
  return (
    <div>
      <div className="ledger-toolbar">
        <span>{filtered.length.toLocaleString('en-US')} transactions</span>
        <LedgerSearch label="Search transactions" query={query} onChange={(value) => { setQuery(value); setPage(0); setExpanded(null); }} />
        <label>
          Action
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(0);
              setExpanded(null);
            }}
          >
            <option value="all">All actions</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <Table className="ledger-table">
        <caption className="sr-only">
          Transactions; select a transaction ID to inspect its token movements
        </caption>
        <TableHeader>
          <TableRow>
            {[
              'Transaction',
              'Action',
              'Protocol',
              'Token movements',
              'Value',
              'Age',
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((t) => (
            <TransactionRows
              key={t.hash}
              transaction={t}
              expanded={expanded === t.hash}
              now={now}
              onExpand={() => setExpanded(expanded === t.hash ? null : t.hash)}
              onProtocol={onProtocol}
            />
          ))}
          {!filtered.length && (
            <TableRow>
              <TableCell colSpan={6} className="ledger-empty">
                No transactions match the current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pager
        page={page}
        total={filtered.length}
        onChange={(p) => {
          setPage(p);
          setExpanded(null);
        }}
      />
    </div>
  );
}
function TransactionRows({
  transaction: t,
  expanded,
  now,
  onExpand,
  onProtocol,
}: {
  transaction: Transaction;
  expanded: boolean;
  now: number;
  onExpand: () => void;
  onProtocol?: (name: string) => void;
}) {
  return (
    <>
      <TableRow>
        <TableCell>
          <button
            className="ledger-link"
            aria-expanded={expanded}
            aria-label={`Inspect transaction ${t.hash}`}
            onClick={onExpand}
          >
            {shortAddress(t.hash)}
          </button>
        </TableCell>
        <TableCell>{t.type}</TableCell>
        <TableCell>
          {onProtocol ? (
            <button
              className="ledger-link"
              onClick={() => onProtocol(t.protocol)}
            >
              {t.protocol}
            </button>
          ) : (
            t.protocol
          )}
        </TableCell>
        <TableCell>
          <div className="transaction-legs">
            {t.movements.map((m) => (
              <span
                key={m.id}
                className={
                  m.direction === 'in' ? 'movement-in' : 'movement-out'
                }
              >
                {m.direction === 'in' ? '+' : '−'}
                {quantity(m.amount)} {m.token}
              </span>
            ))}
          </div>
        </TableCell>
        <TableCell>{t.valueAvailable === false ? '—' : usd(t.value)}</TableCell>
        <TableCell>
          <time
            dateTime={t.timestamp}
            title={`${new Date(t.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' })} UTC`}
          >
            {relativeTime(t.timestamp, now)}
          </time>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6}>
            <div className="transaction-detail">
              <b>Transaction details</b>
              <code>{t.hash}</code>
              {t.fromAddress && (
                <div>
                  <p><b>Initiated by</b> <code>{t.fromAddress}</code></p>
                  <p><b>Receipt status</b> {t.successful ? 'Successful' : 'Failed'}</p>
                </div>
              )}
              {t.movements.map((m) => (
                <div key={m.id}>
                  <span>
                  {m.direction === 'in' ? 'Incoming' : 'Outgoing'}{' '}
                    {quantity(m.amount)} {m.token}
                  </span>
                  <p>
                    <b>From</b> <code>{m.from}</code>
                  </p>
                  <p>
                    <b>To</b> <code>{m.to}</code>
                  </p>
                </div>
              ))}
              <small>{t.successful === undefined ? 'Receipt not verified' : t.successful ? 'Successful receipt' : 'Failed receipt'} · {timestamp(t.timestamp)} UTC</small>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function MovementPanel({
  movements,
  title = 'Token movements',
  subtitle = 'ETH and ERC-20 movements across available history. Direction does not prove who initiated the transaction.',
}: {
  movements: Movement[];
  title?: string;
  subtitle?: string;
}) {
  const [token, setToken] = useState('all');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState('all');
  const [page, setPage] = useState(0);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const filtered = useMemo(() => movements.filter(
    (m) =>
      (token === 'all' || m.token === token) &&
      (direction === 'all' || m.direction === direction) &&
      matchesSearch(query.trim().toLowerCase(), m.hash, m.token, m.tokenAddress, m.from, m.to, m.protocol),
  ).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [movements, token, direction, query]);
  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      window.setTimeout(() => setCopiedHash((current) => current === hash ? null : current), 1600);
    } catch {
      setCopiedHash(null);
    }
  }
  return (
    <section className="panel movements-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="ledger-toolbar">
        <LedgerSearch label="Search movements" query={query} onChange={(value) => { setQuery(value); setPage(0); }} />
        <div className="ledger-filters">
          <label>
            Asset
            <select
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">All tokens</option>
              {[...new Set(movements.map((item) => item.token))].sort().map((symbol) => (
                <option key={symbol}>{symbol}</option>
              ))}
            </select>
          </label>
          <label>
            Direction
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Both ways</option>
              <option value="in">Incoming</option>
              <option value="out">Outgoing</option>
            </select>
          </label>
        </div>
      </div>
      <Table className="ledger-table">
        <caption className="sr-only">
          Token transfer ledger with sender, recipient, and transaction
          identifier
        </caption>
        <TableHeader>
          <TableRow>
            {[
              'Direction',
              'Amount',
              'From',
              'To',
              'Protocol',
              'Transaction',
              'Date (UTC)',
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <span className={`movement-direction movement-${m.direction}`}>
                  {m.direction === 'in' ? (
                    <ArrowDownLeft size={14} />
                  ) : (
                    <ArrowUpRight size={14} />
                  )}
                  {m.direction === 'in' ? 'Incoming' : 'Outgoing'}
                </span>
              </TableCell>
              <TableCell>
                <b>
                  {quantity(m.amount)} {m.token}
                </b>
              </TableCell>
              <TableCell>
                <span title={m.from}>{shortAddress(m.from)}</span>
              </TableCell>
              <TableCell>
                <span title={m.to}>{shortAddress(m.to)}</span>
              </TableCell>
              <TableCell>{m.protocol}</TableCell>
              <TableCell>
                <span className="hash-copy" title={m.hash}>
                  <span>{shortAddress(m.hash)}</span>
                  <button
                    type="button"
                    onClick={() => void copyHash(m.hash)}
                    aria-label={copiedHash === m.hash ? 'Transaction ID copied' : `Copy transaction ID ${m.hash}`}
                    title={copiedHash === m.hash ? 'Copied' : 'Copy transaction ID'}
                  >
                    <Copy size={13} />
                  </button>
                </span>
              </TableCell>
              <TableCell>{timestamp(m.timestamp)}</TableCell>
            </TableRow>
          ))}
          {!filtered.length && (
            <TableRow>
              <TableCell colSpan={7} className="ledger-empty">
                No token movements match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pager page={page} total={filtered.length} onChange={setPage} />
    </section>
  );
}

export function FundFlows({ data }: { data: WalletData }) {
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');
  const flows = useMemo(() => data.flows
    .filter((flow) => matchesSearch(query.trim().toLowerCase(), flow.name, flow.label))
    .sort((a, b) => (b.incoming + b.outgoing) - (a.incoming + a.outgoing)), [data.flows, query]);
  const [selected, setSelected] = useState<{
    name: string;
    direction: 'in' | 'out';
  } | null>(null);
  const filtered = selected
    ? data.movements.filter(
        (m) =>
          m.counterparty === selected.name &&
          m.direction === selected.direction,
      )
    : data.movements;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(flows.length / PAGE_SIZE) - 1),
  );
  const flowSource = data.flows[0]?.source;
  const incoming = data.flows.length
    ? data.flows.reduce((sum, flow) => sum + flow.incoming, 0)
    : data.incoming;
  const outgoing = data.flows.length
    ? data.flows.reduce((sum, flow) => sum + flow.outgoing, 0)
    : data.outgoing;
  const valuation = flowSource === 'nansen-counterparties' ? 'complete' : data.usdValuation ?? 'complete';
  const flowValue = (value: number) => valuation === 'unavailable' ? '—' : usd(value);
  return (
    <>
      <section className="panel flow-panel">
        <div className="panel-heading">
          <div>
            <h2>Fund flows</h2>
            <p>Asset movements on Ethereum · available lifetime history</p>
          </div>
        </div>
        <div className="flow-totals">
          <div>
            <span>Incoming</span>
            <strong>{flowValue(incoming)}</strong>
          </div>
          <div>
            <span>Outgoing</span>
            <strong>{flowValue(outgoing)}</strong>
          </div>
          <div>
            <span>Net flow</span>
            <strong>{flowValue(incoming - outgoing)}</strong>
          </div>
        </div>
        <p className="flow-note">
          Gross token movements valued in USD. Swaps, staking and lending can
          create both incoming and outgoing legs; these values are not profit
          or loss. Select an amount to inspect its underlying transfers.
          {valuation === 'partial' && ' USD totals include only movements with available prices.'}
          {valuation === 'unavailable' && ' USD prices are unavailable for these movements.'}
          {data.movements.some((movement) => movement.usdPriceSource === 'alchemy-daily') &&
            ' Alchemy daily historical prices make these USD values estimates.'}
        </p>
        <div className="ledger-toolbar"><LedgerSearch label="Search counterparties" query={query} onChange={(value) => { setQuery(value); setPage(0); setSelected(null); }} /></div>
        <Table className="ledger-table flow-table">
          <caption className="sr-only">
            Incoming and outgoing fund-flow totals by counterparty
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead>Counterparty</TableHead>
              <TableHead>Incoming</TableHead>
              <TableHead>Outgoing</TableHead>
              <TableHead>Total flow</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows
              .slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
              .map((f) => (
              <TableRow key={f.name}>
                <TableCell>
                  <div className="flow-counterparty">
                    <b>{f.label || shortAddress(f.name)}</b>
                    <small>{f.label ? shortAddress(f.name) : f.interactionCount ? `${f.interactionCount.toLocaleString()} interactions` : 'Wallet address'}</small>
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    className="flow-value-button"
                    disabled={f.incoming === 0}
                    aria-pressed={
                      selected?.name === f.name && selected.direction === 'in'
                    }
                    onClick={() =>
                      setSelected(
                        selected?.name === f.name && selected.direction === 'in'
                          ? null
                          : { name: f.name, direction: 'in' },
                      )
                    }
                  >
                    {flowValue(f.incoming)}
                  </button>
                </TableCell>
                <TableCell>
                  <button
                    className="flow-value-button"
                    disabled={f.outgoing === 0}
                    aria-pressed={
                      selected?.name === f.name && selected.direction === 'out'
                    }
                    onClick={() =>
                      setSelected(
                        selected?.name === f.name && selected.direction === 'out'
                          ? null
                          : { name: f.name, direction: 'out' },
                      )
                    }
                  >
                    {flowValue(f.outgoing)}
                  </button>
                </TableCell>
                <TableCell>{flowValue(f.incoming + f.outgoing)}</TableCell>
              </TableRow>
            ))}
            {!flows.length && (
              <TableRow>
                <TableCell colSpan={4} className="ledger-empty">
                {query.trim() ? 'No counterparties match your search.' : 'No valued fund flows were found in the available history.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Pager page={currentPage} total={flows.length} onChange={setPage} />
        <p className="flow-source">
          {flowSource === 'nansen-counterparties'
            ? 'Counterparty totals supplied by Nansen’s dedicated counterparty analysis.'
            : 'Counterparty totals derived from the retrieved token movements.'}
        </p>
      </section>
      {selected && (
        <div className="flow-selection">
          <span>
            {selected.direction === 'in' ? 'Incoming from' : 'Outgoing to'}{' '}
            <b>{selected.name}</b>
          </span>
          <button className="secondary" onClick={() => setSelected(null)}>
            Show all flows
          </button>
        </div>
      )}
      {selected && <MovementPanel
        key={`${selected.name}-${selected.direction}`}
        movements={filtered}
        title="Transfers behind these flows"
        subtitle={`Showing ${selected.direction === 'in' ? 'incoming' : 'outgoing'} transfers ${selected.direction === 'in' ? 'from' : 'to'} ${selected.name}.`}
      />}
    </>
  );
}
