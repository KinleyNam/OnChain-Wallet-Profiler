const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const outputDir = path.join(root, 'output', 'pdf');
const publicDir = path.join(root, 'public');
const outputPath = path.join(outputDir, 'OnChain-Wallet-Profiler-Methodology.pdf');
const publicPath = path.join(publicDir, 'OnChain-Wallet-Profiler-Methodology.pdf');
fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });

const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 48, left: 50, right: 50 }, info: {
  Title: 'OnChain Wallet Profiler - Methodology',
  Author: 'OnChain',
  Subject: 'Ethereum wallet behavioral profiling methodology and illustrative output',
} });
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);
doc.registerFont('UI', 'C:/Windows/Fonts/arial.ttf');
doc.registerFont('UI-Bold', 'C:/Windows/Fonts/arialbd.ttf');
doc.registerFont('UI-Italic', 'C:/Windows/Fonts/ariali.ttf');

const C = {
  ink: '#252527', muted: '#66636f', faint: '#f3f1f7', line: '#dedde2',
  purple: '#4f32ef', lavender: '#9c83ee', white: '#ffffff', green: '#287a5d',
};
const pageW = 595.28;
const contentW = pageW - 100;

function header(section) {
  doc.font('UI-Bold').fontSize(12).fillColor(C.purple).text('ONCHAIN', 50, 34);
  doc.font('UI').fontSize(8).fillColor(C.muted).text(section.toUpperCase(), 330, 36, { width: 215, align: 'right' });
  doc.moveTo(50, 55).lineTo(545, 55).lineWidth(0.8).strokeColor(C.line).stroke();
}
function footer(page) {
  doc.moveTo(50, 775).lineTo(545, 775).lineWidth(0.6).strokeColor(C.line).stroke();
  doc.font('UI').fontSize(7.5).fillColor(C.muted)
    .text('Ethereum wallet behavioral analytics', 50, 783, { lineBreak: false })
    .text(String(page).padStart(2, '0'), 500, 783, { width: 45, align: 'right', lineBreak: false });
}
function title(kicker, heading, copy) {
  doc.font('UI').fontSize(9).fillColor(C.lavender).text(kicker.toUpperCase(), 50, 82, { characterSpacing: 1.2 });
  doc.font('UI-Bold').fontSize(30).fillColor(C.ink).text(heading, 50, 104, { width: contentW, lineGap: 2 });
  doc.font('UI').fontSize(11).fillColor(C.muted).text(copy, 50, doc.y + 13, { width: 440, lineGap: 4 });
}
function sectionHeading(text, y) {
  doc.font('UI-Bold').fontSize(15).fillColor(C.ink).text(text, 50, y);
}
function chip(text, x, y, width) {
  doc.roundedRect(x, y, width, 25, 4).fill(C.faint);
  doc.font('UI-Bold').fontSize(8).fillColor(C.purple).text(text, x + 9, y + 8, { width: width - 18 });
}
function ruleCard(n, heading, copy, x, y, w) {
  doc.roundedRect(x, y, w, 90, 7).fillAndStroke(C.white, C.line);
  doc.circle(x + 18, y + 19, 9).fill(C.purple);
  doc.font('UI-Bold').fontSize(8).fillColor(C.white).text(String(n), x + 13, y + 15, { width: 10, align: 'center' });
  doc.font('UI-Bold').fontSize(11).fillColor(C.ink).text(heading, x + 34, y + 13, { width: w - 46 });
  doc.font('UI').fontSize(8.7).fillColor(C.muted).text(copy, x + 14, y + 39, { width: w - 28, lineGap: 3 });
}
function metric(label, value, x, y, w) {
  doc.roundedRect(x, y, w, 62, 6).fill(C.faint);
  doc.font('UI').fontSize(8).fillColor(C.muted).text(label, x + 12, y + 11, { width: w - 24 });
  doc.font('UI-Bold').fontSize(18).fillColor(C.ink).text(value, x + 12, y + 29, { width: w - 24 });
}
function scoreRow(name, score, assigned, y) {
  doc.font('UI-Bold').fontSize(9).fillColor(C.ink).text(name, 50, y, { width: 145 });
  doc.roundedRect(205, y + 1, 245, 7, 3.5).fill(C.line);
  doc.roundedRect(205, y + 1, 245 * score / 100, 7, 3.5).fill(assigned ? C.purple : C.lavender);
  doc.font('UI-Bold').fontSize(8).fillColor(assigned ? C.green : C.muted).text(`${score}/100  ${assigned ? 'Assigned' : 'Below threshold'}`, 460, y - 1, { width: 85, align: 'right' });
}

// Page 1
header('Methodology overview');
title('Product documentation', 'How an Ethereum wallet is profiled', 'A concise rule-based approach that connects observable onchain activity to explainable behavioral profiles.');
doc.roundedRect(50, 230, 495, 90, 8).fill('#29282d');
doc.font('UI-Bold').fontSize(12).fillColor(C.white).text('Core principle', 69, 250);
doc.font('UI').fontSize(10).fillColor('#dedde2').text('The profiler does not infer intent from a single transaction. It combines frequency, recency, holdings, token movements and attributed protocol interactions across the selected period.', 69, 273, { width: 455, lineGap: 4 });
sectionHeading('The profiling pipeline', 340);
const steps = [
  ['01', 'Collect', 'Read Ethereum transactions, balances and token movements.'],
  ['02', 'Structure', 'Group activity by day, counterparty and known protocol.'],
  ['03', 'Score', 'Evaluate each profile against transparent rule thresholds.'],
  ['04', 'Explain', 'Show the score, confidence and evidence behind each match.'],
];
steps.forEach(([n, h, c], i) => {
  const x = 50 + i * 124;
  doc.roundedRect(x, 372, 113, 125, 7).fillAndStroke(C.white, C.line);
  doc.font('UI-Bold').fontSize(8).fillColor(C.lavender).text(n, x + 13, 387);
  doc.font('UI-Bold').fontSize(12).fillColor(C.ink).text(h, x + 13, 410);
  doc.font('UI').fontSize(8.5).fillColor(C.muted).text(c, x + 13, 437, { width: 87, lineGap: 3 });
});
sectionHeading('What the output contains', 540);
chip('Primary profile', 50, 571, 104);
chip('Additional matches', 164, 571, 111);
chip('Rule evidence', 285, 571, 94);
chip('Confidence', 389, 571, 78);
chip('Risk indicators', 477, 571, 68);
doc.font('UI').fontSize(9.5).fillColor(C.muted).text('Profiles are assessed independently, so one wallet may match more than one behavior. The highest supported result is presented first, while every rule remains visible for review.', 50, 624, { width: 495, lineGap: 4 });
doc.roundedRect(50, 690, 495, 52, 7).fill(C.faint);
doc.font('UI-Bold').fontSize(9).fillColor(C.ink).text('Default analysis window', 66, 705);
doc.font('UI').fontSize(9).fillColor(C.muted).text('90 days, with 30-day and 180-day alternatives. Wallet age may use the available history beyond the selected window.', 187, 705, { width: 338, lineGap: 3 });
footer(1);

// Page 2
doc.addPage();
header('Profile rules');
title('Rule summary', 'Six profiles, assessed independently', 'Each profile combines a small set of observable signals. A score of 60 or more is treated as a match in the current rule set.');
ruleCard(1, 'Active trader', 'Transaction frequency and active-day coverage indicate regular, repeated activity.', 50, 207, 238);
ruleCard(2, 'Long-term holder', 'At least 90 days of history plus limited outgoing value relative to holdings.', 307, 207, 238);
ruleCard(3, 'DeFi participant', 'Share and breadth of interactions across Uniswap, Aave and Lido.', 50, 316, 238);
ruleCard(4, 'NFT trader', 'Marketplace trade count and activity share across OpenSea and Blur.', 307, 316, 238);
ruleCard(5, 'Staking participant', 'Recurring Lido stake or unstake interactions and their share of activity.', 50, 425, 238);
ruleCard(6, 'Dormant or new wallet', 'Wallet age of 30 days or less, or no observed activity for at least 30 days.', 307, 425, 238);
sectionHeading('Assignment and interpretation', 558);
const notes = [
  ['Threshold', 'A profile is assigned when its rule score reaches 60/100.'],
  ['Primary result', 'The strongest supported profile is highlighted first.'],
  ['Multiple matches', 'A wallet can be both active and DeFi-oriented, for example.'],
  ['Evidence', 'Every result includes the values that affected its score.'],
];
notes.forEach(([h, c], i) => {
  const y = 590 + i * 38;
  doc.font('UI-Bold').fontSize(9).fillColor(C.ink).text(h, 50, y, { width: 90 });
  doc.font('UI').fontSize(9).fillColor(C.muted).text(c, 145, y, { width: 400 });
});
footer(2);

// Page 3
doc.addPage();
header('Illustrative output');
title('Example wallet', 'DeFi participant', 'Illustrative data for the Ethereum address 0x7F00...0003 over a 90-day analysis period.');
metric('Transactions', '1,019', 50, 200, 113);
metric('Active days', '70 / 90', 174, 200, 113);
metric('Transfer volume', '$184,620', 298, 200, 113);
metric('Protocols used', '3', 422, 200, 123);
sectionHeading('Profile rule results', 300);
scoreRow('DeFi participant', 100, true, 337);
scoreRow('Active trader', 89, true, 375);
scoreRow('Long-term holder', 82, true, 413);
scoreRow('Staking participant', 78, true, 451);
scoreRow('NFT trader', 0, false, 489);
scoreRow('Dormant or new wallet', 0, false, 527);
doc.moveTo(50, 575).lineTo(545, 575).lineWidth(0.8).strokeColor(C.line).stroke();
sectionHeading('Supporting evidence', 600);
const evidence = [
  ['Protocol mix', 'Uniswap 28.5%  |  Aave 42.7%  |  Lido 28.9%'],
  ['Activity', '11.3 transactions per day across 70 active days'],
  ['History', '180 days of usable wallet history'],
  ['Attribution', '100% of selected-period transactions attributed'],
];
evidence.forEach(([h, c], i) => {
  const y = 635 + i * 28;
  doc.font('UI-Bold').fontSize(8.5).fillColor(C.ink).text(h, 50, y, { width: 90 });
  doc.font('UI').fontSize(8.5).fillColor(C.muted).text(c, 145, y, { width: 400 });
});
doc.font('UI-Italic').fontSize(7.5).fillColor(C.muted).text('This page uses illustrative frontend data and is included to demonstrate the report structure.', 50, 748, { width: 495 });
footer(3);

doc.end();
stream.on('finish', () => {
  fs.copyFileSync(outputPath, publicPath);
  console.log(outputPath);
  console.log(publicPath);
});

