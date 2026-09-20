"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timestamp = exports.quantity = exports.usd = exports.shortAddress = exports.protocolDefinitions = exports.exampleWallets = exports.assets = exports.AS_OF = void 0;
exports.buildWalletData = buildWalletData;
// Deterministic frontend fixtures. Replace this module with the data service later.
exports.AS_OF = '2026-09-10T23:59:59Z';
const DAY = 86_400_000;
exports.assets = [
    {
        symbol: 'ETH',
        name: 'Ethereum',
        price: 2400,
        opening: 80,
        color: '#9c83ee',
    },
    {
        symbol: 'USDC',
        name: 'USD Coin',
        price: 1,
        opening: 90000,
        color: '#8063cf',
    },
    {
        symbol: 'USDT',
        name: 'Tether',
        price: 1,
        opening: 32000,
        color: '#ada5bc',
    },
    {
        symbol: 'WBTC',
        name: 'Wrapped Bitcoin',
        price: 60000,
        opening: 0.65,
        color: '#655080',
    },
    {
        symbol: 'stETH',
        name: 'Lido Staked ETH',
        price: 2400,
        opening: 12,
        color: '#b6a3e6',
    },
    {
        symbol: 'aUSDC',
        name: 'Aave USDC',
        price: 1,
        opening: 18000,
        color: '#8e91ba',
    },
];
exports.exampleWallets = [
    {
        profile: 'Active trader',
        address: '0x7F00000000000000000000000000000000000001',
    },
    {
        profile: 'Long-term holder',
        address: '0x7F00000000000000000000000000000000000002',
    },
    {
        profile: 'DeFi participant',
        address: '0x7F00000000000000000000000000000000000003',
    },
    {
        profile: 'NFT trader',
        address: '0x7F00000000000000000000000000000000000004',
    },
    {
        profile: 'Staking participant',
        address: '0x7F00000000000000000000000000000000000005',
    },
    {
        profile: 'Payment or transfer wallet',
        address: '0x7F00000000000000000000000000000000000006',
    },
    {
        profile: 'Dormant or new wallet',
        address: '0x7F00000000000000000000000000000000000007',
    },
];
exports.protocolDefinitions = [
    {
        name: 'Uniswap',
        letter: 'U',
        type: 'Decentralized exchange',
        color: '#9c83ee',
    },
    { name: 'Aave', letter: 'A', type: 'Lending & borrowing', color: '#8e91ba' },
    { name: 'Lido', letter: 'L', type: 'Liquid staking', color: '#b6a3e6' },
    {
        name: 'OpenSea',
        letter: 'O',
        type: 'Marketplace protocol',
        color: '#a78cde',
    },
    { name: 'Blur', letter: 'B', type: 'Marketplace protocol', color: '#bcaddb' },
    {
        name: 'No protocol',
        letter: '—',
        type: 'Direct wallet transfers',
        color: '#ada5bc',
    },
    {
        name: 'Unknown',
        letter: '?',
        type: 'Unattributed transfers',
        color: '#ada5bc',
    },
];
const fixedAddress = (n) => '0x' + n.toString(16).padStart(40, '0');
const round = (value, places = 6) => Number(value.toFixed(places));
const shortAddress = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;
exports.shortAddress = shortAddress;
const usd = (value) => value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
});
exports.usd = usd;
const quantity = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 6 });
exports.quantity = quantity;
const timestamp = (value) => new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
});
exports.timestamp = timestamp;
function buildWalletData(address, days) {
    const normalizedAddress = address.toLowerCase();
    const exampleProfile = exports.exampleWallets.find((wallet) => wallet.address.toLowerCase() === normalizedAddress)?.profile;
    const seed = normalizedAddress
        .toLowerCase()
        .split('')
        .reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const factor = 0.8 + (seed % 8) / 20;
    const lifecycleMode = exampleProfile === 'Dormant or new wallet' ? 0 : seed % 11;
    const behaviorMode = exampleProfile === 'Active trader'
        ? 0
        : exampleProfile === 'DeFi participant'
            ? 1
            : exampleProfile === 'NFT trader'
                ? 2
                : exampleProfile === 'Staking participant'
                    ? 3
                    : exampleProfile === 'Payment or transfer wallet'
                        ? 4
                        : seed % 7;
    const opening = Object.fromEntries(exports.assets.map((a) => [a.symbol, round(a.opening * factor)]));
    const balances = { ...opening };
    const all = [];
    for (let age = 179; age >= 0; age--) {
        if (lifecycleMode === 0 && age > 20)
            continue;
        if (lifecycleMode === 1 && age < 45)
            continue;
        const count = exampleProfile === 'Long-term holder'
            ? age % 12 === seed % 12
                ? 1
                : 0
            : (age * 17 + seed) % 9 < 2
                ? 0
                : 3 + ((age * 17 + seed) % 24);
        for (let i = 0; i < count; i++) {
            const n = age * 32 + i;
            const baseKind = (n + seed) % 14;
            let kind = baseKind;
            if (behaviorMode === 0 && baseKind >= 10)
                kind = baseKind % 4;
            if (behaviorMode === 1 && baseKind >= 8)
                kind = 4 + (baseKind % 4);
            if (behaviorMode === 2 && baseKind >= 10)
                kind = 8 + (baseKind % 2);
            if (behaviorMode === 3 && baseKind >= 8)
                kind = 6 + (baseKind % 2);
            if (behaviorMode === 4 && baseKind < 10 && baseKind % 2 === 0) {
                kind = 10 + (baseKind % 4);
            }
            const value = 24 + ((n * 13 + seed) % 96);
            const hash = '0x' +
                Array.from({ length: 8 }, (_, j) => ((Math.imul(seed + n + 1, 2654435761 + j * 97) ^ (j * 123457)) >>> 0)
                    .toString(16)
                    .padStart(8, '0')).join('');
            const time = new Date(Date.UTC(2026, 8, 10 - age, 23 - Math.floor(i / 2), (i * 17) % 60)).toISOString();
            const protocol = kind < 4
                ? 'Uniswap'
                : kind < 6
                    ? 'Aave'
                    : kind < 8
                        ? 'Lido'
                        : kind === 8
                            ? 'OpenSea'
                            : kind === 9
                                ? 'Blur'
                                : 'No protocol';
            const party = protocol === 'No protocol'
                ? fixedAddress(0xa100 + (n % 3))
                : fixedAddress(0xb100 + Math.floor(kind / 2));
            const counterparty = protocol === 'No protocol' ? 'Other wallets' : protocol;
            const movements = [];
            function move(token, direction, amount) {
                const tokenPrice = exports.assets.find((a) => a.symbol === token).price;
                const units = round(amount);
                balances[token] = round(balances[token] + (direction === 'in' ? units : -units));
                movements.push({
                    id: `${hash}:${movements.length}`,
                    hash,
                    timestamp: time,
                    token,
                    amount: units,
                    usd: round(units * tokenPrice, 2),
                    direction,
                    from: direction === 'in' ? party : address,
                    to: direction === 'in' ? address : party,
                    protocol,
                    counterparty,
                });
            }
            let type;
            if (kind < 4) {
                type = 'Swap';
                const token = kind < 2 ? 'ETH' : 'WBTC';
                const price = exports.assets.find((a) => a.symbol === token).price;
                if (kind % 2 === 0) {
                    move('USDC', 'out', value);
                    move(token, 'in', value / price);
                }
                else {
                    move(token, 'out', value / price);
                    move('USDC', 'in', value);
                }
            }
            else if (kind < 6) {
                type = kind === 4 ? 'Supply' : 'Withdraw';
                move('USDC', kind === 4 ? 'out' : 'in', value);
                move('aUSDC', kind === 4 ? 'in' : 'out', value);
            }
            else if (kind < 8) {
                type = kind === 6 ? 'Stake' : 'Unstake';
                move('ETH', kind === 6 ? 'out' : 'in', value / 2400);
                move('stETH', kind === 6 ? 'in' : 'out', value / 2400);
            }
            else if (kind < 10) {
                type = kind === 8 ? 'NFT purchase' : 'NFT sale';
                move('ETH', kind === 8 ? 'out' : 'in', value / 2400);
            }
            else {
                type = kind % 2 === 0 ? 'Receive' : 'Send';
                move('USDT', kind % 2 === 0 ? 'in' : 'out', value);
            }
            all.push({
                hash,
                timestamp: time,
                type,
                protocol,
                movements,
                value: Math.max(...movements.map((m) => m.usd)),
            });
        }
    }
    const start = Date.UTC(2026, 8, 11 - days);
    const orderedHistory = [...all].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const firstActivity = orderedHistory[0]?.timestamp ?? null;
    const lastActivity = orderedHistory.at(-1)?.timestamp ?? null;
    const walletAgeDays = firstActivity
        ? Math.floor((Date.parse(exports.AS_OF) - Date.parse(firstActivity)) / DAY) + 1
        : 0;
    const daysSinceLastActivity = lastActivity
        ? Math.floor((Date.parse(exports.AS_OF) - Date.parse(lastActivity)) / DAY)
        : null;
    const transactions = all
        .filter((t) => Date.parse(t.timestamp) >= start)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const movements = transactions.flatMap((t) => t.movements);
    const daily = Array.from({ length: days }, (_, i) => {
        const key = new Date(start + i * DAY).toISOString().slice(0, 10);
        return transactions.filter((t) => t.timestamp.startsWith(key)).length;
    });
    const holdings = exports.assets
        .map((a) => ({
        ...a,
        balance: balances[a.symbol],
        value: round(balances[a.symbol] * a.price, 2),
    }))
        .sort((a, b) => b.value - a.value);
    const protocols = exports.protocolDefinitions.map((p) => {
        const count = transactions.filter((t) => t.protocol === p.name).length;
        return {
            ...p,
            count,
            share: transactions.length
                ? round((count / transactions.length) * 100, 1)
                : 0,
        };
    });
    const incoming = round(movements
        .filter((m) => m.direction === 'in')
        .reduce((sum, m) => sum + m.usd, 0), 2);
    const outgoing = round(movements
        .filter((m) => m.direction === 'out')
        .reduce((sum, m) => sum + m.usd, 0), 2);
    const flows = [...new Set(movements.map((m) => m.counterparty))]
        .sort()
        .map((name) => ({
        name,
        incoming: round(movements
            .filter((m) => m.counterparty === name && m.direction === 'in')
            .reduce((sum, m) => sum + m.usd, 0), 2),
        outgoing: round(movements
            .filter((m) => m.counterparty === name && m.direction === 'out')
            .reduce((sum, m) => sum + m.usd, 0), 2),
    }));
    return {
        transactions,
        movements,
        daily,
        holdings,
        protocols,
        incoming,
        outgoing,
        flows,
        totalBalance: round(holdings.reduce((sum, h) => sum + h.value, 0), 2),
        volume: round(incoming + outgoing, 2),
        counterparties: new Set(movements.map((m) => (m.direction === 'in' ? m.from : m.to))).size,
        firstActivity,
        lastActivity,
        walletAgeDays,
        daysSinceLastActivity,
        asOf: exports.AS_OF,
        start: new Date(start).toISOString(),
        address,
        days,
        profileHint: exampleProfile ?? null,
    };
}
