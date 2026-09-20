import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
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
  assets,
  quantity,
  shortAddress,
  timestamp,
  usd,
  type Movement,
  type Transaction,
  type WalletData,
} from '@/lib/wallet-data';
import './wallet-panels.css';

const PAGE_SIZE = 10;
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
  return (
    <section className="panel holdings-panel">
      <div className="panel-heading">
        <div>
          <h2>Assets on Ethereum</h2>
          <p>ETH and ERC-20 tokens held on Ethereum · as of Sep 10, 2026</p>
        </div>
        <span className="holdings-count">{data.holdings.length} assets</span>
      </div>
      <div className="portfolio-total">
        <span>Total balance</span>
        <strong>{usd(data.totalBalance)}</strong>
        <small>Ethereum holdings valued in USD at the snapshot date</small>
      </div>
      <div className="allocation-bar" aria-hidden="true">
        {data.holdings.map((h) => (
          <span
            key={h.symbol}
            style={{
              width: `${(h.value / data.totalBalance) * 100}%`,
              background: h.color,
            }}
          />
        ))}
      </div>
      <Table className="ledger-table">
        <caption className="sr-only">
          Token balances and allocation at the snapshot date
        </caption>
        <TableHeader>
          <TableRow>
            {['Asset', 'Balance', 'Price', 'Value', 'Allocation'].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.holdings.map((h) => (
            <TableRow key={h.symbol}>
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
                {((h.value / data.totalBalance) * 100).toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
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
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = transactions.filter(
    (t) => type === 'all' || t.type === type,
  );
  const types = [...new Set(transactions.map((t) => t.type))].sort();
  return (
    <div>
      <div className="ledger-toolbar">
        <span>{transactions.length.toLocaleString()} transactions · UTC</span>
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
              'Date (UTC)',
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
              onExpand={() => setExpanded(expanded === t.hash ? null : t.hash)}
              onProtocol={onProtocol}
            />
          ))}
          {!filtered.length && (
            <TableRow>
              <TableCell colSpan={6} className="ledger-empty">
                No transactions match this action.
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
  onExpand,
  onProtocol,
}: {
  transaction: Transaction;
  expanded: boolean;
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
        <TableCell>
          {usd(t.value)}
        </TableCell>
        <TableCell>{timestamp(t.timestamp)}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6}>
            <div className="transaction-detail">
              <b>Transaction details</b>
              <code>{t.hash}</code>
              {t.movements.map((m) => (
                <div key={m.id}>
                  <span>
                    {m.direction === 'in' ? 'Received' : 'Sent'}{' '}
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
              <small>Confirmed · {timestamp(t.timestamp)} UTC</small>
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
  subtitle = 'ETH and ERC-20 token transfers on Ethereum for the selected period.',
}: {
  movements: Movement[];
  title?: string;
  subtitle?: string;
}) {
  const [token, setToken] = useState('all');
  const [direction, setDirection] = useState('all');
  const [page, setPage] = useState(0);
  const filtered = movements.filter(
    (m) =>
      (token === 'all' || m.token === token) &&
      (direction === 'all' || m.direction === direction),
  );
  const incoming = filtered
    .filter((m) => m.direction === 'in')
    .reduce((sum, m) => sum + m.usd, 0);
  const outgoing = filtered
    .filter((m) => m.direction === 'out')
    .reduce((sum, m) => sum + m.usd, 0);
  return (
    <section className="panel movements-panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="ledger-toolbar">
        <div className="movement-totals">
          <span>
            Received <b>{usd(incoming)}</b>
          </span>
          <span>
            Sent <b>{usd(outgoing)}</b>
          </span>
        </div>
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
              <option value="all">All assets</option>
              {assets.map((a) => (
                <option key={a.symbol}>{a.symbol}</option>
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
              <option value="all">All movements</option>
              <option value="in">Received</option>
              <option value="out">Sent</option>
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
              'Value',
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
                  {m.direction === 'in' ? 'Received' : 'Sent'}
                </span>
              </TableCell>
              <TableCell>
                <b>
                  {quantity(m.amount)} {m.token}
                </b>
              </TableCell>
              <TableCell>{usd(m.usd)}</TableCell>
              <TableCell>
                <span title={m.from}>{shortAddress(m.from)}</span>
              </TableCell>
              <TableCell>
                <span title={m.to}>{shortAddress(m.to)}</span>
              </TableCell>
              <TableCell>{m.protocol}</TableCell>
              <TableCell>
                <details className="hash-details">
                  <summary>{shortAddress(m.hash)}</summary>
                  <code>{m.hash}</code>
                </details>
              </TableCell>
              <TableCell>{timestamp(m.timestamp)}</TableCell>
            </TableRow>
          ))}
          {!filtered.length && (
            <TableRow>
              <TableCell colSpan={8} className="ledger-empty">
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
  return (
    <>
      <section className="panel flow-panel">
        <div className="panel-heading">
          <div>
            <h2>Fund flows</h2>
            <p>Asset movements on Ethereum · last {data.days} days</p>
          </div>
        </div>
        <div className="flow-totals">
          <div>
            <span>Incoming</span>
            <strong>{usd(data.incoming)}</strong>
          </div>
          <div>
            <span>Outgoing</span>
            <strong>{usd(data.outgoing)}</strong>
          </div>
          <div>
            <span>Net flow</span>
            <strong>{usd(data.incoming - data.outgoing)}</strong>
          </div>
        </div>
        <p className="flow-note">
          Gross token movements valued in USD. Swaps, staking and lending can
          create both incoming and outgoing legs; these values are not profit
          or loss. Select an amount to inspect its underlying transfers.
        </p>
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
            {data.flows.map((f) => (
              <TableRow key={f.name}>
                <TableCell><b>{f.name}</b></TableCell>
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
                    {usd(f.incoming)}
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
                    {usd(f.outgoing)}
                  </button>
                </TableCell>
                <TableCell>{usd(f.incoming + f.outgoing)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
      <MovementPanel
        key={selected ? `${selected.name}-${selected.direction}` : 'all'}
        movements={filtered}
        title="Transfers behind these flows"
        subtitle={
          selected
            ? `Showing ${selected.direction === 'in' ? 'incoming' : 'outgoing'} transfers ${selected.direction === 'in' ? 'from' : 'to'} ${selected.name}.`
            : 'Inspect the transfers included in the flow table.'
        }
      />
    </>
  );
}
