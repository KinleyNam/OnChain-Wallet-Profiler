import { useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Images } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region lib/nft-data.ts
var nftCollections = [
	{
		name: "Orbit Glyphs",
		contract: "0x00000000000000000000000000000000000c1001",
		standard: "ERC-721",
		mark: "OG"
	},
	{
		name: "Ether Studies",
		contract: "0x00000000000000000000000000000000000c1002",
		standard: "ERC-721",
		mark: "ES"
	},
	{
		name: "Chain Editions",
		contract: "0x00000000000000000000000000000000000c1003",
		standard: "ERC-1155",
		mark: "CE"
	}
];
//#endregion
//#region lib/wallet-data.ts
var shortAddress = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;
var usd = (value) => value.toLocaleString("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 2
});
var quantity = (value) => value.toLocaleString("en-US", { maximumFractionDigits: 6 });
var timestamp = (value) => new Date(value).toLocaleString("en-US", {
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	timeZone: "UTC"
});
//#endregion
//#region lib/utils.ts
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region components/ui/table.tsx
function Table({ className, ...props }) {
	return /* @__PURE__ */ jsx("div", {
		"data-slot": "table-container",
		className: "relative w-full overflow-x-auto",
		children: /* @__PURE__ */ jsx("table", {
			"data-slot": "table",
			className: cn("w-full caption-bottom text-sm", className),
			...props
		})
	});
}
function TableHeader({ className, ...props }) {
	return /* @__PURE__ */ jsx("thead", {
		"data-slot": "table-header",
		className: cn("[&_tr]:border-b", className),
		...props
	});
}
function TableBody({ className, ...props }) {
	return /* @__PURE__ */ jsx("tbody", {
		"data-slot": "table-body",
		className: cn("[&_tr:last-child]:border-0", className),
		...props
	});
}
function TableRow({ className, ...props }) {
	return /* @__PURE__ */ jsx("tr", {
		"data-slot": "table-row",
		className: cn("hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors has-aria-expanded:bg-muted/50", className),
		...props
	});
}
function TableHead({ className, ...props }) {
	return /* @__PURE__ */ jsx("th", {
		"data-slot": "table-head",
		className: cn("text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0", className),
		...props
	});
}
function TableCell({ className, ...props }) {
	return /* @__PURE__ */ jsx("td", {
		"data-slot": "table-cell",
		className: cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className),
		...props
	});
}
//#endregion
//#region app/wallet-panels.tsx
var PAGE_SIZE = 10;
function Pager({ page, total, onChange }) {
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	return /* @__PURE__ */ jsxs("div", {
		className: "ledger-pagination",
		children: [/* @__PURE__ */ jsx("span", {
			"aria-live": "polite",
			children: total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString()}` : "No records"
		}), /* @__PURE__ */ jsxs("div", { children: [
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "secondary",
				"aria-label": "Previous page",
				disabled: page === 0,
				onClick: () => onChange(page - 1),
				children: /* @__PURE__ */ jsx(ChevronLeft, { size: 16 })
			}),
			/* @__PURE__ */ jsxs("span", { children: [
				"Page ",
				page + 1,
				" of ",
				pages
			] }),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				className: "secondary",
				"aria-label": "Next page",
				disabled: page + 1 >= pages,
				onClick: () => onChange(page + 1),
				children: /* @__PURE__ */ jsx(ChevronRight, { size: 16 })
			})
		] })]
	});
}
function TransactionTable({ transactions, onProtocol }) {
	const [type, setType] = useState("all");
	const [page, setPage] = useState(0);
	const [expanded, setExpanded] = useState(null);
	const filtered = transactions.filter((t) => type === "all" || t.type === type);
	const types = [...new Set(transactions.map((t) => t.type))].sort();
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "ledger-toolbar",
			children: [/* @__PURE__ */ jsxs("span", { children: [transactions.length.toLocaleString(), " transactions · UTC"] }), /* @__PURE__ */ jsxs("label", { children: ["Action", /* @__PURE__ */ jsxs("select", {
				value: type,
				onChange: (e) => {
					setType(e.target.value);
					setPage(0);
					setExpanded(null);
				},
				children: [/* @__PURE__ */ jsx("option", {
					value: "all",
					children: "All actions"
				}), types.map((t) => /* @__PURE__ */ jsx("option", { children: t }, t))]
			})] })]
		}),
		/* @__PURE__ */ jsxs(Table, {
			className: "ledger-table",
			children: [
				/* @__PURE__ */ jsx("caption", {
					className: "sr-only",
					children: "Transactions; select a transaction ID to inspect its token movements"
				}),
				/* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsx(TableRow, { children: [
					"Transaction",
					"Action",
					"Protocol",
					"Token movements",
					"Value",
					"Date (UTC)"
				].map((h) => /* @__PURE__ */ jsx(TableHead, { children: h }, h)) }) }),
				/* @__PURE__ */ jsxs(TableBody, { children: [filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((t) => /* @__PURE__ */ jsx(TransactionRows, {
					transaction: t,
					expanded: expanded === t.hash,
					onExpand: () => setExpanded(expanded === t.hash ? null : t.hash),
					onProtocol
				}, t.hash)), !filtered.length && /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, {
					colSpan: 6,
					className: "ledger-empty",
					children: "No transactions match this action."
				}) })] })
			]
		}),
		/* @__PURE__ */ jsx(Pager, {
			page,
			total: filtered.length,
			onChange: (p) => {
				setPage(p);
				setExpanded(null);
			}
		})
	] });
}
function TransactionRows({ transaction: t, expanded, onExpand, onProtocol }) {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(TableRow, { children: [
		/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx("button", {
			className: "ledger-link",
			"aria-expanded": expanded,
			"aria-label": `Inspect transaction ${t.hash}`,
			onClick: onExpand,
			children: shortAddress(t.hash)
		}) }),
		/* @__PURE__ */ jsx(TableCell, { children: t.type }),
		/* @__PURE__ */ jsx(TableCell, { children: onProtocol ? /* @__PURE__ */ jsx("button", {
			className: "ledger-link",
			onClick: () => onProtocol(t.protocol),
			children: t.protocol
		}) : t.protocol }),
		/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsxs("div", {
			className: "transaction-legs",
			children: [t.nftMovements?.map((n) => /* @__PURE__ */ jsxs("span", {
				className: n.direction === "in" ? "movement-in" : "movement-out",
				children: [
					n.direction === "in" ? "+" : "−",
					n.quantity,
					" ",
					n.collection,
					" #",
					n.tokenId
				]
			}, `${n.contract}:${n.tokenId}`)), t.movements.map((m) => /* @__PURE__ */ jsxs("span", {
				className: m.direction === "in" ? "movement-in" : "movement-out",
				children: [
					m.direction === "in" ? "+" : "−",
					quantity(m.amount),
					" ",
					m.token
				]
			}, m.id))]
		}) }),
		/* @__PURE__ */ jsx(TableCell, { children: t.nftMovements?.length && !t.movements.length ? "No payment" : usd(t.value) }),
		/* @__PURE__ */ jsx(TableCell, { children: timestamp(t.timestamp) })
	] }), expanded && /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, {
		colSpan: 6,
		children: /* @__PURE__ */ jsxs("div", {
			className: "transaction-detail",
			children: [
				/* @__PURE__ */ jsx("b", { children: "Transaction details" }),
				/* @__PURE__ */ jsx("code", { children: t.hash }),
				t.nftMovements?.map((n) => /* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsxs("span", { children: [
						n.direction === "in" ? "Received" : "Sent",
						" ",
						n.quantity,
						" ×",
						" ",
						n.collection,
						" #",
						n.tokenId
					] }),
					/* @__PURE__ */ jsxs("p", { children: [
						/* @__PURE__ */ jsx("b", { children: "Standard" }),
						" ",
						n.standard
					] }),
					/* @__PURE__ */ jsxs("p", { children: [
						/* @__PURE__ */ jsx("b", { children: "Collection contract" }),
						" ",
						/* @__PURE__ */ jsx("code", { children: n.contract })
					] }),
					/* @__PURE__ */ jsxs("p", { children: [
						/* @__PURE__ */ jsx("b", { children: "From" }),
						" ",
						/* @__PURE__ */ jsx("code", { children: n.from }),
						/^0x0{40}$/.test(n.from) && " (mint)"
					] }),
					/* @__PURE__ */ jsxs("p", { children: [
						/* @__PURE__ */ jsx("b", { children: "To" }),
						" ",
						/* @__PURE__ */ jsx("code", { children: n.to })
					] })
				] }, `${n.contract}:${n.tokenId}`)),
				t.movements.map((m) => /* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsxs("span", { children: [
						m.direction === "in" ? "Received" : "Sent",
						" ",
						quantity(m.amount),
						" ",
						m.token
					] }),
					/* @__PURE__ */ jsxs("p", { children: [
						/* @__PURE__ */ jsx("b", { children: "From" }),
						" ",
						/* @__PURE__ */ jsx("code", { children: m.from })
					] }),
					/* @__PURE__ */ jsxs("p", { children: [
						/* @__PURE__ */ jsx("b", { children: "To" }),
						" ",
						/* @__PURE__ */ jsx("code", { children: m.to })
					] })
				] }, m.id)),
				/* @__PURE__ */ jsxs("small", { children: [
					"Confirmed · ",
					timestamp(t.timestamp),
					" UTC"
				] })
			]
		})
	}) })] });
}
//#endregion
//#region app/nft-panel.tsx
function NftPanel({ data, onProtocol }) {
	const [collection, setCollection] = useState("all");
	const [showAll, setShowAll] = useState(false);
	const holdings = data.nftHoldings.filter((h) => collection === "all" || h.contract === collection);
	const history = data.nftTransactions.filter((t) => collection === "all" || t.nftMovements?.some((n) => n.contract === collection));
	const stats = [
		["Purchases", String(data.nftSummary.buys)],
		["Sales", String(data.nftSummary.sells)],
		["Collections traded", String(data.nftSummary.tradedCollections)],
		["Trading volume", usd(data.nftSummary.tradeVolumeUSD)]
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "nft-content",
		children: [
			/* @__PURE__ */ jsxs("section", {
				className: "panel nft-summary",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "panel-heading",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "NFT activity on Ethereum" }), /* @__PURE__ */ jsxs("p", { children: [
							"Purchases, sales, mints and transfers · last ",
							data.days,
							" days"
						] })] }), /* @__PURE__ */ jsx(Images, {
							size: 21,
							"aria-hidden": "true"
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "nft-stats",
						children: stats.map(([label, value]) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", { children: label }), /* @__PURE__ */ jsx("strong", { children: value })] }, label))
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "nft-profile-note",
						children: [/* @__PURE__ */ jsx("span", {
							className: "nft-profile-badge",
							children: data.nftSummary.isTrader ? "NFT Trader" : "NFT activity"
						}), /* @__PURE__ */ jsxs("p", { children: [
							data.nftSummary.isTrader ? `${data.nftSummary.buys + data.nftSummary.sells} completed trades across ${data.nftSummary.tradedCollections} collections on ${data.nftSummary.tradeDays} days.` : "No NFT Trader profile assigned for this period.",
							" ",
							"Only purchases and sales count toward this profile."
						] })]
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "panel nft-holdings",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "panel-heading",
						children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "NFT holdings" }), /* @__PURE__ */ jsx("p", { children: "Owned at Sep 10, 2026 · ERC-721 and ERC-1155 · excluded from the fungible-token balance" })] })
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "ledger-toolbar",
						children: [/* @__PURE__ */ jsxs("span", { children: [
							holdings.reduce((sum, h) => sum + h.quantity, 0),
							" units across",
							" ",
							holdings.length,
							" token IDs"
						] }), /* @__PURE__ */ jsxs("label", { children: ["Collection", /* @__PURE__ */ jsxs("select", {
							value: collection,
							onChange: (e) => {
								setCollection(e.target.value);
								setShowAll(false);
							},
							children: [/* @__PURE__ */ jsx("option", {
								value: "all",
								children: "All collections"
							}), nftCollections.map((c) => /* @__PURE__ */ jsx("option", {
								value: c.contract,
								children: c.name
							}, c.contract))]
						})] })]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "nft-grid",
						children: (showAll ? holdings : holdings.slice(-6).reverse()).map((h) => {
							const c = nftCollections.find((c) => c.contract === h.contract);
							return /* @__PURE__ */ jsxs("article", {
								className: "nft-holding",
								children: [/* @__PURE__ */ jsxs("div", {
									className: `nft-collection-mark nft-mark-${c.mark.toLowerCase()}`,
									"aria-hidden": "true",
									children: [
										/* @__PURE__ */ jsx("span", { children: c.mark }),
										/* @__PURE__ */ jsx("i", {}),
										/* @__PURE__ */ jsx("i", {}),
										/* @__PURE__ */ jsx("i", {})
									]
								}), /* @__PURE__ */ jsxs("div", {
									className: "nft-holding-info",
									children: [
										/* @__PURE__ */ jsx("span", { children: h.collection }),
										/* @__PURE__ */ jsxs("h3", { children: ["#", h.tokenId] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("small", { children: h.standard }), /* @__PURE__ */ jsxs("small", { children: ["Qty ", h.quantity] })] }),
										/* @__PURE__ */ jsxs("details", { children: [
											/* @__PURE__ */ jsx("summary", { children: "Contract details" }),
											/* @__PURE__ */ jsx("code", { children: h.contract }),
											/* @__PURE__ */ jsxs("p", { children: ["Ethereum · ", h.standard] })
										] })
									]
								})]
							}, `${h.contract}:${h.tokenId}`);
						})
					}),
					!holdings.length && /* @__PURE__ */ jsx("p", {
						className: "ledger-empty",
						children: "No NFTs held from this collection at the snapshot date."
					}),
					holdings.length > 6 && /* @__PURE__ */ jsx("button", {
						className: "secondary nft-show-all",
						onClick: () => setShowAll(!showAll),
						children: showAll ? "Show fewer" : `Show all ${holdings.length} token IDs`
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "panel nft-history",
				children: [/* @__PURE__ */ jsx("div", {
					className: "panel-heading",
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "NFT transaction history" }), /* @__PURE__ */ jsx("p", { children: "Includes the NFT, payment asset and transfer direction. Expand a transaction for full addresses." })] })
				}), /* @__PURE__ */ jsx(TransactionTable, {
					transactions: history,
					onProtocol
				}, collection)]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "nft-marketplaces",
				"aria-label": "NFT marketplaces",
				children: [/* @__PURE__ */ jsx("span", { children: "Explore trading activity" }), ["OpenSea / Seaport", "Blur"].map((name) => /* @__PURE__ */ jsxs("button", {
					className: "secondary",
					onClick: () => onProtocol(name),
					children: [name, /* @__PURE__ */ jsx(ArrowUpRight, { size: 14 })]
				}, name))]
			})
		]
	});
}
//#endregion
export { NftPanel };
