import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Wallet } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
//#region lib/wallet-data.ts
var assets = [
	{
		symbol: "ETH",
		name: "Ethereum",
		price: 2400,
		opening: 80,
		color: "#9c83ee"
	},
	{
		symbol: "USDC",
		name: "USD Coin",
		price: 1,
		opening: 9e4,
		color: "#8063cf"
	},
	{
		symbol: "USDT",
		name: "Tether",
		price: 1,
		opening: 32e3,
		color: "#ada5bc"
	},
	{
		symbol: "WBTC",
		name: "Wrapped Bitcoin",
		price: 6e4,
		opening: .65,
		color: "#655080"
	},
	{
		symbol: "stETH",
		name: "Lido Staked ETH",
		price: 2400,
		opening: 12,
		color: "#b6a3e6"
	},
	{
		symbol: "aUSDC",
		name: "Aave USDC",
		price: 1,
		opening: 18e3,
		color: "#8e91ba"
	}
];
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
function BalancesPanel({ data }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "panel holdings-panel",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "panel-heading",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "Wallet balances" }), /* @__PURE__ */ jsx("p", { children: "Holdings as of Sep 10, 2026 · independent of the activity period" })] }), /* @__PURE__ */ jsxs("span", {
					className: "holdings-count",
					children: [data.holdings.length, " assets"]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "portfolio-total",
				children: [
					/* @__PURE__ */ jsx("span", { children: "Total balance" }),
					/* @__PURE__ */ jsx("strong", { children: usd(data.totalBalance) }),
					/* @__PURE__ */ jsx("small", { children: "USD valuation at the snapshot date" })
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "allocation-bar",
				"aria-hidden": "true",
				children: data.holdings.map((h) => /* @__PURE__ */ jsx("span", { style: {
					width: `${h.value / data.totalBalance * 100}%`,
					background: h.color
				} }, h.symbol))
			}),
			/* @__PURE__ */ jsxs(Table, {
				className: "ledger-table",
				children: [
					/* @__PURE__ */ jsx("caption", {
						className: "sr-only",
						children: "Token balances and allocation at the snapshot date"
					}),
					/* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsx(TableRow, { children: [
						"Asset",
						"Balance",
						"Price",
						"Value",
						"Allocation"
					].map((h) => /* @__PURE__ */ jsx(TableHead, { children: h }, h)) }) }),
					/* @__PURE__ */ jsx(TableBody, { children: data.holdings.map((h) => /* @__PURE__ */ jsxs(TableRow, { children: [
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsxs("div", {
							className: "asset-name",
							children: [/* @__PURE__ */ jsx("span", {
								className: "asset-mark",
								style: { borderColor: h.color },
								children: h.symbol.slice(0, 1)
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: h.symbol }), /* @__PURE__ */ jsx("small", { children: h.name })] })]
						}) }),
						/* @__PURE__ */ jsxs(TableCell, { children: [
							quantity(h.balance),
							" ",
							h.symbol
						] }),
						/* @__PURE__ */ jsx(TableCell, { children: usd(h.price) }),
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx("b", { children: usd(h.value) }) }),
						/* @__PURE__ */ jsxs(TableCell, { children: [(h.value / data.totalBalance * 100).toFixed(1), "%"] })
					] }, h.symbol)) })
				]
			})
		]
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
		/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx("div", {
			className: "transaction-legs",
			children: t.movements.map((m) => /* @__PURE__ */ jsxs("span", {
				className: m.direction === "in" ? "movement-in" : "movement-out",
				children: [
					m.direction === "in" ? "+" : "−",
					quantity(m.amount),
					" ",
					m.token
				]
			}, m.id))
		}) }),
		/* @__PURE__ */ jsx(TableCell, { children: usd(t.value) }),
		/* @__PURE__ */ jsx(TableCell, { children: timestamp(t.timestamp) })
	] }), expanded && /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, {
		colSpan: 6,
		children: /* @__PURE__ */ jsxs("div", {
			className: "transaction-detail",
			children: [
				/* @__PURE__ */ jsx("b", { children: "Transaction details" }),
				/* @__PURE__ */ jsx("code", { children: t.hash }),
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
function MovementPanel({ movements, title = "Token movements", subtitle = "Incoming and outgoing transfers for the selected period. ETH movements are included." }) {
	const [token, setToken] = useState("all");
	const [direction, setDirection] = useState("all");
	const [page, setPage] = useState(0);
	const filtered = movements.filter((m) => (token === "all" || m.token === token) && (direction === "all" || m.direction === direction));
	const incoming = filtered.filter((m) => m.direction === "in").reduce((sum, m) => sum + m.usd, 0);
	const outgoing = filtered.filter((m) => m.direction === "out").reduce((sum, m) => sum + m.usd, 0);
	return /* @__PURE__ */ jsxs("section", {
		className: "panel movements-panel",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "panel-heading",
				children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: title }), /* @__PURE__ */ jsx("p", { children: subtitle })] })
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "ledger-toolbar",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "movement-totals",
					children: [/* @__PURE__ */ jsxs("span", { children: ["Received ", /* @__PURE__ */ jsx("b", { children: usd(incoming) })] }), /* @__PURE__ */ jsxs("span", { children: ["Sent ", /* @__PURE__ */ jsx("b", { children: usd(outgoing) })] })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "ledger-filters",
					children: [/* @__PURE__ */ jsxs("label", { children: ["Asset", /* @__PURE__ */ jsxs("select", {
						value: token,
						onChange: (e) => {
							setToken(e.target.value);
							setPage(0);
						},
						children: [/* @__PURE__ */ jsx("option", {
							value: "all",
							children: "All assets"
						}), assets.map((a) => /* @__PURE__ */ jsx("option", { children: a.symbol }, a.symbol))]
					})] }), /* @__PURE__ */ jsxs("label", { children: ["Direction", /* @__PURE__ */ jsxs("select", {
						value: direction,
						onChange: (e) => {
							setDirection(e.target.value);
							setPage(0);
						},
						children: [
							/* @__PURE__ */ jsx("option", {
								value: "all",
								children: "All movements"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "in",
								children: "Received"
							}),
							/* @__PURE__ */ jsx("option", {
								value: "out",
								children: "Sent"
							})
						]
					})] })]
				})]
			}),
			/* @__PURE__ */ jsxs(Table, {
				className: "ledger-table",
				children: [
					/* @__PURE__ */ jsx("caption", {
						className: "sr-only",
						children: "Token transfer ledger with sender, recipient, and transaction identifier"
					}),
					/* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsx(TableRow, { children: [
						"Direction",
						"Amount",
						"Value",
						"From",
						"To",
						"Protocol",
						"Transaction",
						"Date (UTC)"
					].map((h) => /* @__PURE__ */ jsx(TableHead, { children: h }, h)) }) }),
					/* @__PURE__ */ jsxs(TableBody, { children: [filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((m) => /* @__PURE__ */ jsxs(TableRow, { children: [
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsxs("span", {
							className: `movement-direction movement-${m.direction}`,
							children: [m.direction === "in" ? /* @__PURE__ */ jsx(ArrowDownLeft, { size: 14 }) : /* @__PURE__ */ jsx(ArrowUpRight, { size: 14 }), m.direction === "in" ? "Received" : "Sent"]
						}) }),
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsxs("b", { children: [
							quantity(m.amount),
							" ",
							m.token
						] }) }),
						/* @__PURE__ */ jsx(TableCell, { children: usd(m.usd) }),
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx("span", {
							title: m.from,
							children: shortAddress(m.from)
						}) }),
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsx("span", {
							title: m.to,
							children: shortAddress(m.to)
						}) }),
						/* @__PURE__ */ jsx(TableCell, { children: m.protocol }),
						/* @__PURE__ */ jsx(TableCell, { children: /* @__PURE__ */ jsxs("details", {
							className: "hash-details",
							children: [/* @__PURE__ */ jsx("summary", { children: shortAddress(m.hash) }), /* @__PURE__ */ jsx("code", { children: m.hash })]
						}) }),
						/* @__PURE__ */ jsx(TableCell, { children: timestamp(m.timestamp) })
					] }, m.id)), !filtered.length && /* @__PURE__ */ jsx(TableRow, { children: /* @__PURE__ */ jsx(TableCell, {
						colSpan: 8,
						className: "ledger-empty",
						children: "No token movements match these filters."
					}) })] })
				]
			}),
			/* @__PURE__ */ jsx(Pager, {
				page,
				total: filtered.length,
				onChange: setPage
			})
		]
	});
}
function FundFlows({ data }) {
	const [selected, setSelected] = useState(null);
	const max = Math.max(1, ...data.flows.flatMap((f) => [f.incoming, f.outgoing]));
	const filtered = selected ? data.movements.filter((m) => m.counterparty === selected.name && m.direction === selected.direction) : data.movements;
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("section", {
			className: "panel flow-panel",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "panel-heading",
					children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "Fund flows" }), /* @__PURE__ */ jsxs("p", { children: [
						"Movement of assets into and out of this wallet · last ",
						data.days,
						" ",
						"days"
					] })] })
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flow-totals",
					children: [
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", { children: "Incoming" }), /* @__PURE__ */ jsx("strong", { children: usd(data.incoming) })] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", { children: "Outgoing" }), /* @__PURE__ */ jsx("strong", { children: usd(data.outgoing) })] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", { children: "Net flow" }), /* @__PURE__ */ jsx("strong", { children: usd(data.incoming - data.outgoing) })] })
					]
				}),
				/* @__PURE__ */ jsx("section", {
					className: "flow-scroll",
					"aria-label": "Fund flow diagram. Select a source or destination to inspect its transfers.",
					children: /* @__PURE__ */ jsxs("div", {
						className: "flow-canvas",
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "flow-column-label flow-source-label",
								children: "Sources"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "flow-column-label flow-wallet-label",
								children: "Selected wallet"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "flow-column-label flow-destination-label",
								children: "Destinations"
							}),
							/* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 960 380",
								preserveAspectRatio: "none",
								"aria-hidden": "true",
								children: data.flows.map((f, i) => {
									const y = 80 + i * 82;
									return /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("path", {
										className: "flow-line incoming-line",
										d: `M 195 ${y} C 300 ${y}, 290 204, 384 204`,
										strokeWidth: 3 + f.incoming / max * 18
									}), /* @__PURE__ */ jsx("path", {
										className: "flow-line outgoing-line",
										d: `M 576 204 C 660 204, 660 ${y}, 765 ${y}`,
										strokeWidth: 3 + f.outgoing / max * 18
									})] }, f.name);
								})
							}),
							data.flows.flatMap((f, i) => ["in", "out"].map((direction) => /* @__PURE__ */ jsxs("button", {
								className: `flow-node flow-node-${direction}`,
								style: { top: 51 + i * 82 },
								"aria-pressed": selected?.name === f.name && selected.direction === direction,
								"aria-label": `${direction === "in" ? "Incoming from" : "Outgoing to"} ${f.name}: ${usd(direction === "in" ? f.incoming : f.outgoing)}. Show transfers.`,
								onClick: () => setSelected(selected?.name === f.name && selected.direction === direction ? null : {
									name: f.name,
									direction
								}),
								children: [/* @__PURE__ */ jsx("span", { children: f.name }), /* @__PURE__ */ jsx("strong", { children: usd(direction === "in" ? f.incoming : f.outgoing) })]
							}, f.name + direction))),
							/* @__PURE__ */ jsxs("div", {
								className: "flow-wallet",
								children: [
									/* @__PURE__ */ jsx(Wallet, { size: 21 }),
									/* @__PURE__ */ jsx("b", { children: "Selected wallet" }),
									/* @__PURE__ */ jsx("span", { children: shortAddress(data.address) })
								]
							})
						]
					})
				}),
				/* @__PURE__ */ jsx("p", {
					className: "flow-note",
					children: "Gross token movements valued in USD. Swaps, staking and lending can create both incoming and outgoing legs; these are not profit or loss. Line widths reflect value. Select a node to inspect transfers."
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "flow-accessible",
					children: [/* @__PURE__ */ jsx("summary", { children: "View flow totals as a table" }), /* @__PURE__ */ jsxs(Table, {
						className: "ledger-table",
						children: [/* @__PURE__ */ jsx(TableHeader, { children: /* @__PURE__ */ jsxs(TableRow, { children: [
							/* @__PURE__ */ jsx(TableHead, { children: "Counterparty" }),
							/* @__PURE__ */ jsx(TableHead, { children: "Incoming" }),
							/* @__PURE__ */ jsx(TableHead, { children: "Outgoing" })
						] }) }), /* @__PURE__ */ jsx(TableBody, { children: data.flows.map((f) => /* @__PURE__ */ jsxs(TableRow, { children: [
							/* @__PURE__ */ jsx(TableCell, { children: f.name }),
							/* @__PURE__ */ jsx(TableCell, { children: usd(f.incoming) }),
							/* @__PURE__ */ jsx(TableCell, { children: usd(f.outgoing) })
						] }, f.name)) })]
					})]
				})
			]
		}),
		selected && /* @__PURE__ */ jsxs("div", {
			className: "flow-selection",
			children: [/* @__PURE__ */ jsxs("span", { children: [
				selected.direction === "in" ? "Incoming from" : "Outgoing to",
				" ",
				/* @__PURE__ */ jsx("b", { children: selected.name })
			] }), /* @__PURE__ */ jsx("button", {
				className: "secondary",
				onClick: () => setSelected(null),
				children: "Show all flows"
			})]
		}),
		/* @__PURE__ */ jsx(MovementPanel, {
			movements: filtered,
			title: "Transfers behind these flows",
			subtitle: selected ? `Showing ${selected.direction === "in" ? "incoming" : "outgoing"} transfers ${selected.direction === "in" ? "from" : "to"} ${selected.name}.` : "Inspect the transfers included in the visualization."
		}, selected ? `${selected.name}-${selected.direction}` : "all")
	] });
}
//#endregion
export { BalancesPanel, FundFlows, MovementPanel, TransactionTable };
