import type { ProfileResult } from '../server/classification';
import { quantity, shortAddress, timestamp, type Transaction } from '@/lib/wallet-data';

const emptyExplanations: Record<string, string> = {
  'Long-term holder': 'Retention is checked against historical balances. No recent outgoing or DEX transaction is linked to this result.',
  'Staking participant': 'The position and continuous history are checked from balances and position records. No deposit transaction hash is available.',
  'Dormant or new wallet': 'No wallet-initiated transaction hash is available. Dormancy is checked from complete transaction history, including the absence of recent sends.',
};

export function TransactionReferences({
  references,
  total,
  transactionByHash,
  context,
  emptyText,
}: {
  references: NonNullable<ProfileResult['relatedTransactions']>;
  total: number;
  transactionByHash: Map<string, Transaction>;
  context?: string;
  emptyText: string;
}) {
  if (!total) {
    return <p className="proof-empty">{emptyText}</p>;
  }
  return (
    <details className="proof-list">
      <summary>
        Show related transactions ({references.length === total ? total : `${references.length} of ${total}`})
      </summary>
      {context && <p className="proof-context">{context}</p>}
      <ul>
        {references.map((reference) => {
          const transaction = transactionByHash.get(reference.hash.toLowerCase());
          return (
            <li key={reference.hash}>
              <details className="proof-transaction">
                <summary>
                  <span>{reference.label}</span>
                  <code title={reference.hash}>{shortAddress(reference.hash)}</code>
                  <time dateTime={reference.timestamp}>{timestamp(reference.timestamp)} UTC</time>
                </summary>
                <div className="proof-transaction-body">
                  <code>{reference.hash}</code>
                  {transaction ? (
                    <>
                      <p>{transaction.type} · {transaction.protocol} · {transaction.successful === undefined ? 'Receipt status unavailable' : transaction.successful ? 'Successful receipt' : 'Failed receipt'}</p>
                      {transaction.fromAddress && <p>From <code>{transaction.fromAddress}</code></p>}
                      {transaction.toAddress && <p>To <code>{transaction.toAddress}</code></p>}
                      {transaction.movements.length > 0 && (
                        <ul>
                          {transaction.movements.map((movement) => (
                            <li key={movement.id}>
                              {movement.direction === 'in' ? 'Received' : 'Sent'} {quantity(movement.amount)} {movement.token}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : <p>Transaction details are outside the loaded activity ledger.</p>}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function ProfileTransactionProof({
  profile,
  transactionByHash,
}: {
  profile: ProfileResult;
  transactionByHash: Map<string, Transaction>;
}) {
  const references = profile.relatedTransactions ?? [];
  return <TransactionReferences
    references={references}
    total={profile.relatedTransactionCount ?? references.length}
    transactionByHash={transactionByHash}
    emptyText={emptyExplanations[profile.name] ?? 'No verified transaction hash is available for this result.'}
  />;
}
