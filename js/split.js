/*
 * Bill split in integer cents.
 * The tip is shared in proportion to each person's subtotal.
 * Leftover cents go to the largest fractional shares (ties keep list order)
 * so the per-person totals add up to the table total exactly.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.DivideCuenta = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_CENTS = 999999999;

  function priceMessage(code) {
    if (code === 'empty') return 'Escribe un precio.';
    if (code === 'zero') return 'El precio debe ser mayor que cero.';
    if (code === 'negative') return 'El precio no puede ser negativo.';
    if (code === 'too-large') return 'Ese monto es demasiado grande.';
    return 'Ese precio no es válido. Ejemplo: 12.50.';
  }

  function tipMessage(code) {
    if (code === 'empty') return 'Escribe el monto de la propina.';
    if (code === 'negative') return 'La propina no puede ser negativa.';
    if (code === 'too-large') return 'Ese monto es demasiado grande.';
    return 'Ese monto no es válido. Ejemplo: 5.00.';
  }

  function fail(code, kind) {
    return {
      ok: false,
      code: code,
      message: kind === 'tip' ? tipMessage(code) : priceMessage(code)
    };
  }

  function parseAmountToCents(raw, options) {
    var opts = options || {};
    var kind = opts.kind === 'tip' ? 'tip' : 'price';
    var allowZero = !!opts.allowZero;
    var text = String(raw == null ? '' : raw).trim();

    if (text === '') return fail('empty', kind);

    var negative = false;
    var first = text.charAt(0);
    if (first === '-' || first === '−' || first === '–') {
      negative = true;
      text = text.slice(1).trim();
      if (text === '') return fail('negative', kind);
    }

    if (text.indexOf(',') !== -1 && text.indexOf('.') !== -1) {
      return fail('invalid', kind);
    }
    text = text.replace(',', '.');

    if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(text)) {
      return fail('invalid', kind);
    }

    if (negative) return fail('negative', kind);

    var parts = text.split('.');
    if (parts[0].length > 9) return fail('too-large', kind);

    var whole = parts[0] === '' ? 0 : parseInt(parts[0], 10);
    var frac = parts[1] || '';
    var cents = whole * 100;

    if (frac.length > 0) {
      var fracDigits = (frac + '00').slice(0, 2);
      cents += parseInt(fracDigits, 10);
      if (frac.length > 2 && frac.charAt(2) >= '5') cents += 1;
    }

    if (!isFinite(cents) || cents > MAX_CENTS) return fail('too-large', kind);
    if (cents === 0 && !allowZero) return fail('zero', kind);
    return { ok: true, cents: cents };
  }

  function cleanName(raw) {
    return String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
  }

  function validatePersonName(raw) {
    var name = cleanName(raw);
    if (!name) return { ok: false, message: 'Escribe un nombre.' };
    if (name.length > 60) return { ok: false, message: 'El nombre es demasiado largo.' };
    return { ok: true, name: name };
  }

  function validateItemName(raw) {
    var name = cleanName(raw);
    if (!name) return { ok: false, message: 'Escribe el plato o la bebida.' };
    if (name.length > 80) return { ok: false, message: 'El nombre es demasiado largo.' };
    return { ok: true, name: name };
  }

  function percentOf(cents, percent) {
    var pct = Number(percent) || 0;
    if (pct <= 0 || cents <= 0) return 0;
    var numerator = cents * pct;
    var base = Math.floor(numerator / 100);
    var rem = numerator % 100;
    if (rem < 0) rem += 100;
    if (rem >= 50) base += 1;
    return base;
  }

  function distributeCents(totalCents, weights) {
    var count = weights.length;
    var result = new Array(count);
    var i;

    for (i = 0; i < count; i += 1) result[i] = 0;
    if (count === 0 || totalCents <= 0) return result;

    var weightSum = 0;
    for (i = 0; i < count; i += 1) weightSum += weights[i] > 0 ? weights[i] : 0;

    if (weightSum === 0) {
      var even = Math.floor(totalCents / count);
      var spare = totalCents - even * count;
      for (i = 0; i < count; i += 1) result[i] = even + (i < spare ? 1 : 0);
      return result;
    }

    var remainders = [];
    var allocated = 0;
    for (i = 0; i < count; i += 1) {
      var weight = weights[i] > 0 ? weights[i] : 0;
      var numerator = totalCents * weight;
      var share = Math.floor(numerator / weightSum);
      result[i] = share;
      allocated += share;
      remainders.push({ index: i, rem: numerator % weightSum });
    }

    var leftover = totalCents - allocated;
    remainders.sort(function (a, b) {
      if (b.rem !== a.rem) return b.rem - a.rem;
      return a.index - b.index;
    });

    for (i = 0; i < leftover; i += 1) {
      result[remainders[i].index] += 1;
    }
    return result;
  }

  function calculateBill(people, tip) {
    var list = people || [];
    var rows = list.map(function (person) {
      var subtotal = 0;
      var items = person.items || [];
      for (var i = 0; i < items.length; i += 1) {
        var cents = items[i].priceCents;
        if (typeof cents === 'number' && isFinite(cents) && cents > 0) {
          subtotal += Math.round(cents);
        }
      }
      return {
        id: person.id,
        name: person.name,
        subtotalCents: subtotal
      };
    });

    var subtotalCents = 0;
    for (var r = 0; r < rows.length; r += 1) subtotalCents += rows[r].subtotalCents;

    var tipCents = 0;
    var tipMode = tip && tip.type;
    if (tipMode === 'percent') {
      tipCents = percentOf(subtotalCents, tip.percent);
    } else if (tipMode === 'custom') {
      var custom = tip.cents;
      if (typeof custom === 'number' && isFinite(custom) && custom > 0) {
        tipCents = Math.round(custom);
      }
    }

    var shares = distributeCents(tipCents, rows.map(function (row) {
      return row.subtotalCents;
    }));

    var out = [];
    for (var j = 0; j < rows.length; j += 1) {
      out.push({
        id: rows[j].id,
        name: rows[j].name,
        subtotalCents: rows[j].subtotalCents,
        tipCents: shares[j],
        totalCents: rows[j].subtotalCents + shares[j]
      });
    }

    return {
      rows: out,
      subtotalCents: subtotalCents,
      tipCents: tipCents,
      totalCents: subtotalCents + tipCents
    };
  }

  function formatSoles(cents) {
    var value = Math.round(Number(cents) || 0);
    var negative = value < 0;
    var abs = Math.abs(value);
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var fracText = frac < 10 ? '0' + frac : String(frac);
    return 'S/ ' + (negative ? '-' : '') + whole + '.' + fracText;
  }

  function centsToInput(cents) {
    var value = Math.round(Number(cents) || 0);
    var abs = Math.abs(value);
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var fracText = frac < 10 ? '0' + frac : String(frac);
    return (value < 0 ? '-' : '') + whole + '.' + fracText;
  }

  function buildWhatsAppMessage(bill) {
    var lines = ['Cuenta de la mesa 🍽️'];
    var rows = (bill && bill.rows) || [];
    for (var i = 0; i < rows.length; i += 1) {
      var name = cleanName(rows[i].name) || 'Sin nombre';
      lines.push(name + ': ' + formatSoles(rows[i].totalCents));
    }
    lines.push('Total: ' + formatSoles(bill ? bill.totalCents : 0));
    return lines.join('\n');
  }

  return {
    parseAmountToCents: parseAmountToCents,
    validatePersonName: validatePersonName,
    validateItemName: validateItemName,
    calculateBill: calculateBill,
    formatSoles: formatSoles,
    centsToInput: centsToInput,
    buildWhatsAppMessage: buildWhatsAppMessage
  };
});
