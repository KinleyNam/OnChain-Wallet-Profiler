import { PROFILE_RULES } from './classification-rules';

export type ProfileStatus = 'ASSIGNED' | 'NOT_ASSIGNED' | 'NOT_ASSESSED';
export type ProfileResult = {
  name: string;
  status: ProfileStatus;
  score: number | null;
  threshold: number | null;
  assigned: boolean;
  reason?: 'new' | 'dormant';
  evidence: string;
  dataCoverage: 'complete' | 'incomplete';
  missingInputs: string[];
  matchedRules: Array<{ id: string; points: number }>;
  variables: Record<string, number | string | boolean | null>;
};

export type RetainedHolding = {
  tokenId: string;
  recognised: boolean;
  reconstructable: boolean;
  startingBalance: number;
  currentBalance: number;
  startingPriceUsd: number;
  grossOutgoingUnits: number;
  minimumBalance: number;
};

export type ClassificationEvidence = {
  cutoff: string;
  activeTrader?: {
    dexTransactions?: number;
    outgoingTransactions?: number;
    tradingDays?: number;
    tradedTokenIds?: string[];
  };
  longTermHolder?: {
    holdings?: RetainedHolding[];
    holdingHistoryComplete?: boolean;
    recentOutgoingTransactions?: number;
    recentDexTrades?: number;
  };
  defiParticipant?: {
    transactions?: number;
    days?: number;
    protocolIds?: string[];
    actionTypes?: string[];
  };
  nftTrader?: {
    tradeTransactions?: number;
    tradingDays?: number;
    collectionIds?: string[];
    hasPurchases?: boolean;
    hasSales?: boolean;
  };
  stakingParticipant?: {
    hasActivePosition?: boolean;
    hasVerifiedDeposit?: boolean;
    hasDepositInLast90Days?: boolean;
    continuousStakingDays?: number;
  };
  dormantOrNew?: {
    firstActivityKnown?: boolean;
    firstActivityAt?: string | null;
    lifetimeInitiatedTransactions?: number;
    initiatedTransactions90d?: number;
  };
};

function uniqueCount(values: string[]) {
  return new Set(values.map((value) => value.toLowerCase())).size;
}

const INPUT_LABELS: Record<string, string> = {
  dexTransactions: 'verified DEX swaps',
  outgoingTransactions: 'successful wallet-initiated transactions',
  tradingDays: 'verified trading days',
  tradedTokenIds: 'traded token contract IDs',
  holdings: 'historical token balances and transfer events',
  holdingHistoryComplete: 'complete 90-day holding history',
  recentOutgoingTransactions: 'successful outgoing transactions in 30 days',
  recentDexTrades: 'verified DEX trades in 30 days',
  transactions: 'qualifying DeFi transactions',
  days: 'qualifying activity dates',
  protocolIds: 'verified protocol IDs',
  actionTypes: 'verified DeFi action types',
  tradeTransactions: 'verified NFT sale transactions',
  collectionIds: 'NFT collection contracts',
  hasPurchases: 'verified NFT buyer roles',
  hasSales: 'verified NFT seller roles',
  hasActivePosition: 'current staking position',
  hasVerifiedDeposit: 'wallet-attributed staking deposit',
  hasDepositInLast90Days: 'staking deposits in 90 days',
  continuousStakingDays: 'uninterrupted staking history',
};

function result(
  name: string,
  threshold: number | null,
  score: number | null,
  assigned: boolean,
  evidence: string,
  matchedRules: Array<{ id: string; points: number }>,
  variables: ProfileResult['variables'],
  missingInputs: string[] = [],
  reason?: 'new' | 'dormant',
): ProfileResult {
  return {
    name,
    threshold,
    score,
    assigned,
    status: missingInputs.length
      ? 'NOT_ASSESSED'
      : assigned
        ? 'ASSIGNED'
        : 'NOT_ASSIGNED',
    evidence,
    dataCoverage: missingInputs.length ? 'incomplete' : 'complete',
    matchedRules,
    variables,
    missingInputs,
    ...(reason ? { reason } : {}),
  };
}

function unassessed(
  name: string,
  threshold: number | null,
  missingInputs: string[],
  variables: ProfileResult['variables'] = {},
): ProfileResult {
  return result(
    name,
    threshold,
    null,
    false,
    `Not enough data to verify ${missingInputs.map((input) => INPUT_LABELS[input] ?? input).join(', ')}.`,
    [],
    variables,
    missingInputs,
  );
}

function missing(source: Record<string, unknown>, fields: string[]) {
  return fields.filter(
    (field) => source[field] === undefined || source[field] === null,
  );
}

export function isQualifyingHolding(holding: RetainedHolding): boolean {
  const rules = PROFILE_RULES.longTermHolder;
  if (
    !holding.recognised ||
    !holding.reconstructable ||
    holding.startingBalance <= 0
  )
    return false;
  if (
    ![
      holding.startingBalance,
      holding.currentBalance,
      holding.startingPriceUsd,
      holding.grossOutgoingUnits,
      holding.minimumBalance,
    ].every(Number.isFinite)
  )
    return false;
  return (
    holding.startingBalance * holding.startingPriceUsd >=
      rules.minimumStartingValueUsd &&
    holding.minimumBalance > 0 &&
    (holding.currentBalance / holding.startingBalance) * 100 >=
      rules.minimumRetentionPercent &&
    (holding.grossOutgoingUnits / holding.startingBalance) * 100 <=
      rules.maximumOutgoingPercent
  );
}

export function classify(evidence: ClassificationEvidence): ProfileResult[] {
  const results: ProfileResult[] = [];
  const trader = evidence.activeTrader ?? {};
  const traderMissing = missing(trader, [
    'dexTransactions',
    'outgoingTransactions',
    'tradingDays',
    'tradedTokenIds',
  ]);
  if (traderMissing.length) {
    results.push(
      unassessed(
        'Active trader',
        PROFILE_RULES.activeTrader.threshold,
        traderMissing,
      ),
    );
  } else {
    const trades = trader.dexTransactions!;
    const outgoing = trader.outgoingTransactions!;
    const days = trader.tradingDays!;
    const tokens = uniqueCount(trader.tradedTokenIds!);
    const ratio = outgoing > 0 ? (trades / outgoing) * 100 : null;
    if (trades > outgoing) {
      results.push(
        unassessed('Active trader', PROFILE_RULES.activeTrader.threshold, [
          'consistent swap and outgoing transaction counts',
        ]),
      );
    } else {
      const matched = [
        [
          'AT1',
          PROFILE_RULES.activeTrader.points.AT1,
          trades >= PROFILE_RULES.activeTrader.tradeCount,
        ],
        [
          'AT2',
          PROFILE_RULES.activeTrader.points.AT2,
          ratio !== null && ratio >= PROFILE_RULES.activeTrader.tradeRatio,
        ],
        [
          'AT3',
          PROFILE_RULES.activeTrader.points.AT3,
          days >= PROFILE_RULES.activeTrader.tradingDays,
        ],
        [
          'AT4',
          PROFILE_RULES.activeTrader.points.AT4,
          tokens >= PROFILE_RULES.activeTrader.tokens,
        ],
      ] as const;
      const rules = matched
        .filter(([, , passes]) => passes)
        .map(([id, points]) => ({ id, points }));
      const score = rules.reduce((sum, rule) => sum + rule.points, 0);
      const assigned =
        score >= PROFILE_RULES.activeTrader.threshold &&
        trades >= PROFILE_RULES.activeTrader.minimumTrades &&
        days >= PROFILE_RULES.activeTrader.minimumDays;
      results.push(
        result(
          'Active trader',
          PROFILE_RULES.activeTrader.threshold,
          score,
          assigned,
          `${trades} verified swaps on ${days} days; ${ratio === null ? 'no outgoing transactions' : `${ratio.toFixed(1)}% of successful outgoing transactions`} were swaps.`,
          rules,
          {
            dex_transactions: trades,
            outgoing_transactions: outgoing,
            trading_days: days,
            tokens_traded: tokens,
            trade_ratio: ratio,
          },
        ),
      );
    }
  }

  const holder = evidence.longTermHolder ?? {};
  const holderMissing = missing(holder, [
    'holdings',
    'holdingHistoryComplete',
    'recentOutgoingTransactions',
    'recentDexTrades',
  ]);
  if (holder.holdingHistoryComplete === false)
    holderMissing.push('complete 90-day balance and transfer history');
  if (holderMissing.length) {
    results.push(
      unassessed('Long-term holder', PROFILE_RULES.longTermHolder.threshold, [
        ...new Set(holderMissing),
      ]),
    );
  } else {
    const qualifying = holder.holdings!.filter(isQualifyingHolding);
    const recentOutgoing = holder.recentOutgoingTransactions!;
    const recentDex = holder.recentDexTrades!;
    const rules = [
      ['LH1', PROFILE_RULES.longTermHolder.points.LH1, qualifying.length > 0],
      [
        'LH2',
        PROFILE_RULES.longTermHolder.points.LH2,
        recentOutgoing <= PROFILE_RULES.longTermHolder.maximumRecentOutgoing,
      ],
      ['LH3', PROFILE_RULES.longTermHolder.points.LH3, recentDex === 0],
    ] as const;
    const matched = rules
      .filter(([, , passes]) => passes)
      .map(([id, points]) => ({ id, points }));
    const score = matched.reduce((sum, rule) => sum + rule.points, 0);
    results.push(
      result(
        'Long-term holder',
        PROFILE_RULES.longTermHolder.threshold,
        score,
        score >= PROFILE_RULES.longTermHolder.threshold &&
          qualifying.length > 0,
        `${qualifying.length} qualifying retained holdings; ${recentOutgoing} successful outgoing transactions and ${recentDex} DEX trades in 30 days.`,
        matched,
        {
          qualifying_holdings: qualifying.length,
          recent_outgoing_transactions: recentOutgoing,
          recent_dex_trades: recentDex,
        },
      ),
    );
  }

  const defi = evidence.defiParticipant ?? {};
  const defiMissing = missing(defi, [
    'transactions',
    'days',
    'protocolIds',
    'actionTypes',
  ]);
  if (defiMissing.length) {
    results.push(
      unassessed(
        'DeFi participant',
        PROFILE_RULES.defiParticipant.threshold,
        defiMissing,
      ),
    );
  } else {
    const transactions = defi.transactions!;
    const days = defi.days!;
    const protocols = uniqueCount(defi.protocolIds!);
    const actions = uniqueCount(defi.actionTypes!);
    const rules = [
      [
        'DF1',
        PROFILE_RULES.defiParticipant.points.DF1,
        transactions >= PROFILE_RULES.defiParticipant.transactions,
      ],
      [
        'DF2',
        PROFILE_RULES.defiParticipant.points.DF2,
        days >= PROFILE_RULES.defiParticipant.days,
      ],
      [
        'DF3',
        PROFILE_RULES.defiParticipant.points.DF3,
        protocols >= PROFILE_RULES.defiParticipant.protocols,
      ],
      [
        'DF4',
        PROFILE_RULES.defiParticipant.points.DF4,
        actions >= PROFILE_RULES.defiParticipant.actionTypes,
      ],
    ] as const;
    const matched = rules
      .filter(([, , passes]) => passes)
      .map(([id, points]) => ({ id, points }));
    const score = matched.reduce((sum, rule) => sum + rule.points, 0);
    results.push(
      result(
        'DeFi participant',
        PROFILE_RULES.defiParticipant.threshold,
        score,
        score >= PROFILE_RULES.defiParticipant.threshold &&
          transactions >= PROFILE_RULES.defiParticipant.minimumTransactions,
        `${transactions} verified lending or liquidity transactions on ${days} days across ${protocols} protocols.`,
        matched,
        {
          defi_transactions: transactions,
          defi_days: days,
          defi_protocols: protocols,
          defi_action_types: actions,
        },
      ),
    );
  }

  const nft = evidence.nftTrader ?? {};
  const nftMissing = missing(nft, [
    'tradeTransactions',
    'tradingDays',
    'collectionIds',
    'hasPurchases',
    'hasSales',
  ]);
  if (nftMissing.length) {
    results.push(
      unassessed('NFT trader', PROFILE_RULES.nftTrader.threshold, nftMissing),
    );
  } else {
    const trades = nft.tradeTransactions!;
    const days = nft.tradingDays!;
    const collections = uniqueCount(nft.collectionIds!);
    const rules = [
      [
        'NF1',
        PROFILE_RULES.nftTrader.points.NF1,
        trades >= PROFILE_RULES.nftTrader.tradeCount,
      ],
      [
        'NF2',
        PROFILE_RULES.nftTrader.points.NF2,
        days >= PROFILE_RULES.nftTrader.days,
      ],
      [
        'NF3',
        PROFILE_RULES.nftTrader.points.NF3,
        nft.hasPurchases! && nft.hasSales!,
      ],
      [
        'NF4',
        PROFILE_RULES.nftTrader.points.NF4,
        collections >= PROFILE_RULES.nftTrader.collections,
      ],
    ] as const;
    const matched = rules
      .filter(([, , passes]) => passes)
      .map(([id, points]) => ({ id, points }));
    const score = matched.reduce((sum, rule) => sum + rule.points, 0);
    results.push(
      result(
        'NFT trader',
        PROFILE_RULES.nftTrader.threshold,
        score,
        score >= PROFILE_RULES.nftTrader.threshold &&
          trades >= PROFILE_RULES.nftTrader.minimumTrades,
        `${trades} verified NFT purchase or sale transactions on ${days} days across ${collections} collections.`,
        matched,
        {
          nft_trade_transactions: trades,
          nft_trading_days: days,
          nft_collections: collections,
          has_purchases: nft.hasPurchases!,
          has_sales: nft.hasSales!,
        },
      ),
    );
  }

  const staking = evidence.stakingParticipant ?? {};
  const stakingMissing = missing(staking, [
    'hasActivePosition',
    'hasVerifiedDeposit',
    'hasDepositInLast90Days',
    'continuousStakingDays',
  ]);
  if (stakingMissing.length) {
    results.push(
      unassessed(
        'Staking participant',
        PROFILE_RULES.stakingParticipant.threshold,
        stakingMissing,
      ),
    );
  } else {
    const rules = [
      [
        'ST1',
        PROFILE_RULES.stakingParticipant.points.ST1,
        staking.hasActivePosition!,
      ],
      [
        'ST2',
        PROFILE_RULES.stakingParticipant.points.ST2,
        staking.hasDepositInLast90Days!,
      ],
      [
        'ST3',
        PROFILE_RULES.stakingParticipant.points.ST3,
        staking.continuousStakingDays! >=
          PROFILE_RULES.stakingParticipant.minimumContinuousDays,
      ],
    ] as const;
    const matched = rules
      .filter(([, , passes]) => passes)
      .map(([id, points]) => ({ id, points }));
    const score = matched.reduce((sum, rule) => sum + rule.points, 0);
    results.push(
      result(
        'Staking participant',
        PROFILE_RULES.stakingParticipant.threshold,
        score,
        score >= PROFILE_RULES.stakingParticipant.threshold &&
          staking.hasActivePosition! &&
          staking.hasVerifiedDeposit!,
        `${staking.hasActivePosition ? 'Active' : 'No active'} verified position; ${staking.hasVerifiedDeposit ? 'deposit verified' : 'no verified deposit'}; ${staking.continuousStakingDays} uninterrupted days.`,
        matched,
        {
          has_staking_position: staking.hasActivePosition!,
          has_verified_stake: staking.hasVerifiedDeposit!,
          staked_in_last_90_days: staking.hasDepositInLast90Days!,
          continuous_staking_days: staking.continuousStakingDays!,
        },
      ),
    );
  }

  const inactivity = evidence.dormantOrNew ?? {};
  const cutoff = Date.parse(evidence.cutoff);
  const first = inactivity.firstActivityAt
    ? Date.parse(inactivity.firstActivityAt)
    : null;
  if (
    inactivity.firstActivityKnown !== true ||
    !Number.isFinite(cutoff) ||
    (first !== null && (!Number.isFinite(first) || first > cutoff))
  ) {
    results.push(
      unassessed('Dormant or new wallet', null, [
        'verified first wallet-initiated activity or complete no-history confirmation',
      ]),
    );
  } else if (first === null) {
    results.push(
      result(
        'Dormant or new wallet',
        null,
        null,
        false,
        'No wallet-initiated activity found in verified complete history.',
        [],
        { first_activity_at: null },
      ),
    );
  } else {
    const ageDays = (cutoff - first) / 86_400_000;
    const newAge = ageDays <= PROFILE_RULES.dormantOrNew.newAgeDays;
    const dormantAge = ageDays >= PROFILE_RULES.dormantOrNew.dormantAgeDays;
    const newKnown =
      !newAge || inactivity.lifetimeInitiatedTransactions !== undefined;
    const dormantKnown =
      !dormantAge || inactivity.initiatedTransactions90d !== undefined;
    const isNew =
      newAge &&
      inactivity.lifetimeInitiatedTransactions! >= 1 &&
      inactivity.lifetimeInitiatedTransactions! <=
        PROFILE_RULES.dormantOrNew.maximumNewLifetimeTransactions;
    const isDormant = dormantAge && inactivity.initiatedTransactions90d === 0;
    const variables = {
      first_activity_at: inactivity.firstActivityAt!,
      age_days: ageDays,
      lifetime_transaction_count:
        inactivity.lifetimeInitiatedTransactions ?? null,
      transactions_90d: inactivity.initiatedTransactions90d ?? null,
    };
    if (isNew || isDormant) {
      const reason = isNew ? 'new' : 'dormant';
      results.push(
        result(
          'Dormant or new wallet',
          null,
          null,
          true,
          isNew
            ? `First wallet-initiated activity ${ageDays.toFixed(1)} days ago; ${inactivity.lifetimeInitiatedTransactions} lifetime transactions.`
            : `No wallet-initiated transactions in 90 days; first activity ${ageDays.toFixed(1)} days ago.`,
          [],
          variables,
          [],
          reason,
        ),
      );
    } else if (!newKnown || !dormantKnown) {
      results.push(
        unassessed(
          'Dormant or new wallet',
          null,
          [
            !newKnown ? 'complete lifetime transaction count' : '',
            !dormantKnown
              ? 'complete 90-day wallet-initiated transaction count'
              : '',
          ].filter(Boolean),
          variables,
        ),
      );
    } else {
      results.push(
        result(
          'Dormant or new wallet',
          null,
          null,
          false,
          `First wallet-initiated activity ${ageDays.toFixed(1)} days ago; neither condition matched.`,
          [],
          variables,
        ),
      );
    }
  }
  return results;
}
