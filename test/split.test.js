'use strict';

var DC = require('../js/split.js');
var failed = 0;
var passed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log('ok  ' + message);
    return;
  }
  failed += 1;
  console.error('FAIL ' + message);
}

function assertEqual(actual, expected, message) {
  var same = actual === expected;
  if (!same && typeof actual === 'object' && actual !== null) {
    same = JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (same) {
    passed += 1;
    console.log('ok  ' + message);
    return;
  }
  failed += 1;
  console.error('FAIL ' + message);
  console.error('     expected: ' + JSON.stringify(expected));
  console.error('     actual:   ' + JSON.stringify(actual));
}

function person(name, priceCentsList) {
  return {
    id: name,
    name: name,
    items: priceCentsList.map(function (cents, index) {
      return { id: name + '-' + index, name: 'Pedido', priceCents: cents };
    })
  };
}

function soles(amount) {
  var parsed = DC.parseAmountToCents(String(amount), { allowZero: false, kind: 'price' });
  if (!parsed.ok) throw new Error('Bad fixture price ' + amount + ': ' + parsed.message);
  return parsed.cents;
}

function sum(values) {
  return values.reduce(function (total, value) { return total + value; }, 0);
}

var ten = soles('10');
assertEqual(ten, 1000, 'S/ 10 parses to 1000 cents');

var trio = [person('Ana', [ten]), person('Luis', [ten]), person('María', [ten])];
var tenPercent = DC.calculateBill(trio, { type: 'percent', percent: 10 });

assertEqual(tenPercent.subtotalCents, 3000, '10% case subtotal is S/ 30.00');
assertEqual(tenPercent.tipCents, 300, '10% tip is S/ 3.00');
assertEqual(tenPercent.totalCents, 3300, '10% case table total is S/ 33.00');
assertEqual(DC.formatSoles(tenPercent.totalCents), 'S/ 33.00', 'table total formats as S/ 33.00');
tenPercent.rows.forEach(function (row) {
  assertEqual(row.totalCents, 1100, row.name + ' pays S/ 11.00');
  assertEqual(DC.formatSoles(row.totalCents), 'S/ 11.00', row.name + ' formats as S/ 11.00');
  assertEqual(row.tipCents, 100, row.name + ' tip share is S/ 1.00');
});
assertEqual(sum(tenPercent.rows.map(function (row) { return row.totalCents; })), tenPercent.totalCents, '10% per-person totals sum to the table total');

var custom = DC.calculateBill(trio, { type: 'custom', cents: soles('10') });
assertEqual(custom.tipCents, 1000, 'custom tip is S/ 10.00');
assertEqual(custom.totalCents, 4000, 'custom tip table total is S/ 40.00');
assertEqual(DC.formatSoles(custom.totalCents), 'S/ 40.00', 'custom total formats as S/ 40.00');
var customTotals = custom.rows.map(function (row) { return row.totalCents; }).sort(function (a, b) { return a - b; });
assertEqual(customTotals, [1333, 1333, 1334], 'custom tip pays S/ 13.33 or S/ 13.34');
assertEqual(sum(custom.rows.map(function (row) { return row.totalCents; })), 4000, 'custom per-person totals sum to exactly S/ 40.00');
assertEqual(sum(custom.rows.map(function (row) { return row.tipCents; })), 1000, 'custom tip shares sum to S/ 10.00');
assert(
  custom.rows.every(function (row) { return row.totalCents === 1333 || row.totalCents === 1334; }),
  'every person is on a reconciled cent'
);

var emptyPrice = DC.parseAmountToCents('', { allowZero: false, kind: 'price' });
assertEqual(emptyPrice.ok, false, 'empty price is rejected');
assertEqual(emptyPrice.code, 'empty', 'empty price code');
assertEqual(emptyPrice.message, 'Escribe un precio.', 'empty price message');

var blankPrice = DC.parseAmountToCents('   ', { allowZero: false, kind: 'price' });
assertEqual(blankPrice.code, 'empty', 'blank price is empty');

var zeroPrice = DC.parseAmountToCents('0', { allowZero: false, kind: 'price' });
assertEqual(zeroPrice.ok, false, 'zero price is rejected');
assertEqual(zeroPrice.message, 'El precio debe ser mayor que cero.', 'zero price message');

var zeroDecimal = DC.parseAmountToCents('0,00', { allowZero: false, kind: 'price' });
assertEqual(zeroDecimal.code, 'zero', '0,00 is zero');

var negativePrice = DC.parseAmountToCents('-5', { allowZero: false, kind: 'price' });
assertEqual(negativePrice.ok, false, 'negative price is rejected');
assertEqual(negativePrice.code, 'negative', 'negative price code');
assertEqual(negativePrice.message, 'El precio no puede ser negativo.', 'negative price message');

var negativeDecimal = DC.parseAmountToCents('-0.50', { allowZero: false, kind: 'price' });
assertEqual(negativeDecimal.code, 'negative', 'negative decimal is rejected');

assertEqual(DC.parseAmountToCents('12.50', { allowZero: false, kind: 'price' }).cents, 1250, '12.50 is 1250 cents');
assertEqual(DC.parseAmountToCents('12,5', { allowZero: false, kind: 'price' }).cents, 1250, '12,5 is 1250 cents');
assertEqual(DC.parseAmountToCents('10.10', { allowZero: false, kind: 'price' }).cents, 1010, '10.10 avoids binary float error');
assertEqual(DC.parseAmountToCents('1.005', { allowZero: false, kind: 'price' }).cents, 101, '1.005 rounds half up to S/ 1.01');
assertEqual(DC.parseAmountToCents('abc', { allowZero: false, kind: 'price' }).code, 'invalid', 'letters are invalid');
assertEqual(DC.parseAmountToCents('0.001', { allowZero: false, kind: 'price' }).code, 'zero', 'amount that rounds to zero is rejected');

var emptyName = DC.validatePersonName('   ');
assertEqual(emptyName.ok, false, 'empty name is rejected');
assertEqual(emptyName.message, 'Escribe un nombre.', 'empty name message');
assertEqual(DC.validatePersonName('  Ana  ').name, 'Ana', 'name is trimmed');
assertEqual(DC.validateItemName('').message, 'Escribe el plato o la bebida.', 'empty item name message');

var uneven = DC.calculateBill(
  [person('Ana', [2000]), person('Luis', [1000])],
  { type: 'percent', percent: 15 }
);
assertEqual(uneven.tipCents, 450, '15% of S/ 30.00 is S/ 4.50');
assertEqual(uneven.rows[0].tipCents, 300, 'Ana tip share matches 2/3 of the tip');
assertEqual(uneven.rows[1].tipCents, 150, 'Luis tip share matches 1/3 of the tip');
assertEqual(uneven.rows[0].totalCents + uneven.rows[1].totalCents, uneven.totalCents, 'uneven totals reconcile');

var weights = [
  [1, 1, 1],
  [1, 2, 3],
  [10, 10, 10],
  [1, 1, 2],
  [100, 1, 1],
  [7, 13, 19, 4],
  [0, 500, 500],
  [0, 0, 0],
  [1],
  [999, 1, 50]
];
var tips = [0, 1, 2, 3, 10, 99, 100, 1000];
weights.forEach(function (group) {
  tips.forEach(function (tipCents) {
    var bill = DC.calculateBill(
      group.map(function (cents, index) {
        return person('P' + index, cents > 0 ? [cents] : []);
      }),
      { type: 'custom', cents: tipCents }
    );
    var peopleSum = sum(bill.rows.map(function (row) { return row.totalCents; }));
    var tipSum = sum(bill.rows.map(function (row) { return row.tipCents; }));
    assertEqual(peopleSum, bill.totalCents, 'reconcile weights ' + group.join('+') + ' tip ' + tipCents);
    assertEqual(tipSum, bill.tipCents, 'tip shares sum weights ' + group.join('+') + ' tip ' + tipCents);
  });
});

var message = DC.buildWhatsAppMessage(tenPercent);
assertEqual(
  message,
  'Cuenta de la mesa 🍽️\nAna: S/ 11.00\nLuis: S/ 11.00\nMaría: S/ 11.00\nTotal: S/ 33.00',
  'WhatsApp message matches the expected shape'
);

assertEqual(DC.formatSoles(0), 'S/ 0.00', 'zero soles');
assertEqual(DC.formatSoles(10), 'S/ 0.10', 'ten cents');
assertEqual(DC.centsToInput(1250), '12.50', 'cents edit field');

var zeroTip = DC.parseAmountToCents('0', { allowZero: true, kind: 'tip' });
assertEqual(zeroTip.ok, true, 'a custom tip of zero is allowed');
assertEqual(zeroTip.cents, 0, 'zero tip cents');
var negativeTip = DC.parseAmountToCents('-2', { allowZero: true, kind: 'tip' });
assertEqual(negativeTip.message, 'La propina no puede ser negativa.', 'negative tip message');

var esKeys = Object.keys(DC.STRINGS.es).sort();
var enKeys = Object.keys(DC.STRINGS.en).sort();
assertEqual(esKeys, enKeys, 'every translation key exists in both languages');
esKeys.forEach(function (key) {
  assert(typeof DC.STRINGS.es[key] === 'string' && DC.STRINGS.es[key].trim() !== '', 'Spanish string for ' + key);
  assert(typeof DC.STRINGS.en[key] === 'string' && DC.STRINGS.en[key].trim() !== '', 'English string for ' + key);
});
assertEqual(DC.STRINGS.en.waTitle, 'Table bill 🍽️', 'English WhatsApp title');
assertEqual(DC.STRINGS.es.waTitle, 'Cuenta de la mesa 🍽️', 'Spanish WhatsApp title');
assertEqual(DC.STRINGS.en.copied, 'Copied!', 'English copied label');
assertEqual(DC.STRINGS.es.copied, '¡Copiado!', 'Spanish copied label');
assertEqual(
  DC.buildWhatsAppMessage(tenPercent, 'en'),
  'Table bill 🍽️\nAna: S/ 11.00\nLuis: S/ 11.00\nMaría: S/ 11.00\nTotal: S/ 33.00',
  'English WhatsApp message keeps soles amounts'
);
assertEqual(DC.messageFor('price', 'empty', 'en'), 'Enter a price.', 'English empty price message');
assertEqual(DC.messageFor('price', 'empty', 'es'), 'Escribe un precio.', 'Spanish empty price message stays in the table');

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
