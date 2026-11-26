# OnChain Wallet Profiler

## UX case study draft

**Project type:** Responsive web app  
**Role:** UX/UI design and frontend implementation (edit this to reflect your actual role)  
**Platform:** Desktop and mobile web  
**Status:** Existing interactive prototype and implementation; research and usability validation still need to be completed  
**Tools visible in the project:** React, TypeScript, CSS, Recharts

> Replace bracketed details and adjust the role statement so it accurately describes your contribution before submitting this case study.

## Overview

OnChain Wallet Profiler helps people explore the public activity of an Ethereum wallet. A visitor enters an address and can review balances, transaction activity, token movements, fund flows, protocol interactions, behavioral indicators, and the evidence behind profile classifications.

The central design challenge is making complex blockchain records understandable without presenting an automated profile as a definitive judgment. The interface therefore organizes analysis into dedicated views and shows data coverage, supporting evidence, and cases where there is not enough information.

## The problem

Ethereum activity is public, but the records are difficult to interpret. People may need to open many explorers, inspect transactions one by one, and make sense of technical details before they can understand a wallet's overall patterns.

**Design opportunity:** bring relevant wallet records into one place, help people move from summary to transaction-level evidence, and make uncertainty visible.

This problem framing is a project hypothesis based on the product's capabilities. It has not yet been validated with participant interviews.

## Intended users and needs

These are initial audience hypotheses, not research findings:

- **Crypto-curious learner:** wants a plain-language overview of a wallet's activity.
- **Researcher or analyst:** wants to inspect transactions, counterparties, and protocol interactions.
- **Wallet owner:** wants to understand how their own address appears from public on-chain records.

### User stories

1. As a curious user, I want to enter an Ethereum address and see whether it is valid, so I can begin an analysis without guessing the required format.
2. As a wallet researcher, I want a concise overview of balances and activity, so I can understand the wallet before exploring details.
3. As an analyst, I want to filter and inspect incoming and outgoing token movements, so I can follow how assets moved.
4. As an analyst, I want to see counterparties and protocol interactions, so I can understand which addresses and services appear in the history.
5. As a cautious user, I want each profile result to show its supporting rules and transactions, so I can judge how the result was reached.
6. As a user reviewing incomplete history, I want to see missing data and coverage limits, so I do not mistake partial records for a complete picture.
7. As a user, I want to distinguish an activity indicator from a fraud or investment rating, so I do not overinterpret the score.
8. As a returning user, I want the analyzed wallet to remain in the URL, so I can revisit or share the same view.

## Product goals

- Make wallet analysis approachable for people who are not blockchain experts.
- Let users move from a summary to the underlying records.
- Explain how profile results are assessed and when available data is insufficient.
- Keep the experience useful across desktop and mobile web.

## Information architecture

The profiler is organized into eight views:

1. **Overview** — profiles, balance, transaction count, active days, activity indicator, and activity chart.
2. **Balances** — current assets and values.
3. **Activity** — transaction history and activity patterns.
4. **Token movements** — incoming and outgoing transfers.
5. **Fund flows** — value grouped by counterparty.
6. **Protocols used** — attributed protocol interactions.
7. **Risk indicators** — measured behavioral signals, with context that the score is not a fraud or financial rating.
8. **Profile evidence** — rule results, related transactions, data coverage, provenance, and methodology.

## Primary user flow

```text
Landing page
  → Enter Ethereum address
  → Validate address
  → Load available wallet records
  → Review overview
  → Open a detail view
  → Inspect profile evidence and data coverage
```

The product also includes invalid-address, loading, empty, and smart-contract states in its interactive prototype.

## Low fidelity wireframes

These sketches describe the page structure before visual styling. They are recreated from the existing product flow as design documentation; they are not historical artifacts from the original design process.

### 1. Address entry

```text
+--------------------------------------------------------------+
| BRAND                                      How it works       |
|                                                              |
|              Understand an Ethereum wallet                   |
|       Review available activity and its supporting records    |
|                                                              |
|       [ 0x... paste Ethereum wallet address       ] [Analyze] |
|       Address format error appears here when invalid          |
|                                                              |
|              What the profiler can show                       |
+--------------------------------------------------------------+
```

### 2. Wallet overview

```text
+--------------------------------------------------------------+
| BRAND   [wallet address]                    [Copy] [Export]   |
| [Overview] [Balances] [Activity] [Movements] [Flows] ...      |
+--------------------------------------------------------------+
| [Primary profile + evidence link] | [Total balance] [Tx count]|
|                                  | [Active days] [Indicator]  |
+--------------------------------------------------------------+
| Activity over time                | Counterparty summary      |
| [---------------- chart --------] | [summary metrics]         |
+--------------------------------------------------------------+
| Activity by day and hour [heatmap]                            |
+--------------------------------------------------------------+
```

### 3. Profile evidence

```text
+--------------------------------------------------------------+
| [Overview] [Balances] [Activity] ... [Profile evidence]       |
+--------------------------------------------------------------+
| Profiles assessed | Profiles assigned | Signals | Records     |
+--------------------------------------------------------------+
| Active trader      | Status / score                         |
| Matched rules and evidence summary                             |
| [Expand related transactions]                                  |
+--------------------------------------------------------------+
| Long-term holder   | Status / score                         |
| Matched rules and evidence summary                             |
+--------------------------------------------------------------+
| Data sources, coverage, cutoff, and unavailable inputs         |
+--------------------------------------------------------------+
```

## High fidelity design and prototype

The existing application is the high fidelity implementation. The landing page introduces the profiler and accepts an address. The profiler uses a persistent tab structure, metric cards, charts, tables, evidence panels, and detail dialogs to support progressively deeper exploration.

The standalone click-through prototype is in [`prototype/index.html`](../prototype/index.html). It can be opened locally and includes sample states and wallet profiles. Its sample addresses and figures are illustrative; it does not perform live on-chain analysis. The implemented application is represented by the files in `app/` and `components/`.

**Suggested portfolio visuals:** capture the landing page, overview, transaction/activity view, and profile evidence view from the running prototype or application. Add captions that explain what the user can learn from each screen.

## Design decisions

- **Summary before detail:** the overview gives users a starting point, while tabs keep specialized data available without crowding the first screen.
- **Evidence next to conclusions:** profile results include matched rules and related transactions to support review.
- **Coverage and uncertainty are visible:** unavailable or incomplete inputs can affect assessment; the UI surfaces provenance and “Not enough data” states.
- **Use neutral language for behavioral signals:** the interface describes an activity indicator and explicitly says it is not a fraud, sanction, credit, security, or investment-risk rating.
- **Separate analysis views:** balances, activity, movements, flows, protocols, indicators, and evidence each have their own view for focused exploration.

## Research and validation plan

No interview notes or usability-test results were found in the project folder. Do not present the following as completed research. Use it as the next step:

1. Interview 4–5 people who have used a blockchain explorer or researched a wallet. Ask how they currently investigate an address and what they find confusing.
2. Test the prototype with 5 participants. Ask them to find a wallet's main profile, inspect a transaction, identify an unavailable data source, and explain what the activity indicator means.
3. Record task completion, errors, time on task, and participant comments. Update the design based on observed issues.

### Questions to validate

- Do users understand what an Ethereum address is and what data the tool can access?
- Can users distinguish observed facts from inferred profile classifications?
- Can users find the evidence behind a profile result?
- Do users understand what missing or partial data means?
- Does the risk-indicator language avoid implying a fraud or investment judgment?

## Limitations and ethical considerations

- Public blockchain data can be incomplete, delayed, or difficult to attribute to a person or organization.
- A behavioral profile is a rule-based interpretation of available records, not a verified identity or intent.
- Scores can be misunderstood as financial, security, or fraud ratings; the interface should keep limitations close to the result.
- Users should avoid entering an address under the assumption that analysis reveals the real-world identity of its owner.

## Reflection

The project brings multiple wallet datasets into a single exploration flow and makes evidence part of the analysis experience. The next improvement should come from observing real users: confirm that the categories make sense, find where technical language blocks understanding, and check whether people can correctly interpret incomplete data and profile results.

## Submission checklist

- [ ] Replace the role statement with an accurate description of your contribution.
- [ ] Add your name, project dates, and the tools you personally used.
- [ ] Add screenshots of the real prototype/application screens.
- [ ] If you conduct interviews or usability tests, include the actual method, participant count, findings, and resulting design changes.
- [ ] Keep hypotheses, proposed research, and illustrative prototype data labeled as such.
- [ ] Check your teacher's portfolio instructions if they become available.
