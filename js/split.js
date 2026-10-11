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

  var STRINGS = {
    es: {
      metaDescription: 'Dividex. Divide la cuenta de la mesa en soles: platos, propina proporcional y un mensaje listo para WhatsApp.',
      langGroup: 'Idioma',
      eyebrow: 'Divide la cuenta',
      lede: 'Anota lo que pidió cada persona, elige la propina y copia el resumen para WhatsApp.',
      peopleHeading: 'Personas',
      nameLabel: 'Nombre',
      namePlaceholder: 'Ana',
      addPerson: 'Agregar persona',
      emptyTitle: 'La mesa está vacía',
      emptyBody: 'Agrega a cada persona y anota sus platos o bebidas. La cuenta se actualiza al instante.',
      save: 'Guardar',
      cancel: 'Cancelar',
      confirmDelete: '¿Eliminar a {name} y todo lo que pidió?',
      confirmDeleteYes: 'Sí, eliminar',
      edit: 'Editar',
      remove: 'Eliminar',
      removeItem: 'Eliminar {name}',
      noItems: 'Todavía no hay pedidos.',
      subtotal: 'Subtotal',
      dishLabel: 'Plato o bebida',
      dishPlaceholder: 'Lomo saltado',
      priceLabel: 'Precio (S/)',
      pricePlaceholder: '12.50',
      addItem: 'Agregar',
      receiptKicker: 'Cuenta',
      billHeading: 'La cuenta',
      tipHelp: 'La propina se reparte según lo que consumió cada persona.',
      tipGroup: 'Propina',
      tipCustomButton: 'Otro',
      customTipLabel: 'Monto de la propina (S/)',
      customTipPlaceholder: '10.00',
      grandLabel: 'Total de la mesa',
      tableCaption: 'Reparto de la cuenta por persona',
      colPerson: 'Persona',
      colSubtotal: 'Subtotal',
      colTip: 'Propina',
      colTotal: 'Total',
      footTotal: 'Total',
      billEmpty: 'Agrega personas para ver el reparto.',
      adjustNote: 'Los céntimos se ajustan para que la suma de las personas cuadre exacto con el total.',
      waLabel: 'Mensaje para WhatsApp',
      waEmpty: 'Agrega personas para armar el mensaje.',
      copyButton: 'Copiar para WhatsApp',
      copied: '¡Copiado!',
      copyFallback: 'No se pudo copiar automáticamente. Selecciona el mensaje de arriba y cópialo a mano.',
      copyFailedStatus: 'No se pudo copiar automáticamente.',
      footer: 'Divide la cuenta · propina al sol, al céntimo.',
      noscript: 'Activa JavaScript para dividir la cuenta.',
      tipCustom: 'Propina personalizada',
      tipNone: 'Sin propina',
      tipPercent: 'Propina {percent}%',
      tipAmount: 'Propina {amount}',
      waTitle: 'Cuenta de la mesa 🍽️',
      waTotal: 'Total:',
      unnamed: 'Sin nombre',
      errPriceEmpty: 'Escribe un precio.',
      errPriceZero: 'El precio debe ser mayor que cero.',
      errPriceNegative: 'El precio no puede ser negativo.',
      errAmountTooLarge: 'Ese monto es demasiado grande.',
      errPriceInvalid: 'Ese precio no es válido. Ejemplo: 12.50.',
      errTipEmpty: 'Escribe el monto de la propina.',
      errTipNegative: 'La propina no puede ser negativa.',
      errTipInvalid: 'Ese monto no es válido. Ejemplo: 5.00.',
      errPersonEmpty: 'Escribe un nombre.',
      errNameTooLong: 'El nombre es demasiado largo.',
      errItemEmpty: 'Escribe el plato o la bebida.'
    },
    en: {
      metaDescription: 'Dividex. Split a table bill in soles: dishes, a proportional tip, and a message ready for WhatsApp.',
      langGroup: 'Language',
      eyebrow: 'Split the bill',
      lede: 'Write down what each person ordered, choose the tip, and copy a summary for WhatsApp.',
      peopleHeading: 'People',
      nameLabel: 'Name',
      namePlaceholder: 'Ana',
      addPerson: 'Add person',
      emptyTitle: 'The table is empty',
      emptyBody: 'Add each person and note their dishes or drinks. The bill updates instantly.',
      save: 'Save',
      cancel: 'Cancel',
      confirmDelete: 'Remove {name} and everything they ordered?',
      confirmDeleteYes: 'Yes, remove',
      edit: 'Edit',
      remove: 'Remove',
      removeItem: 'Remove {name}',
      noItems: 'No orders yet.',
      subtotal: 'Subtotal',
      dishLabel: 'Dish or drink',
      dishPlaceholder: 'Grilled chicken',
      priceLabel: 'Price (S/)',
      pricePlaceholder: '12.50',
      addItem: 'Add',
      receiptKicker: 'Bill',
      billHeading: 'The bill',
      tipHelp: 'The tip is split according to what each person consumed.',
      tipGroup: 'Tip',
      tipCustomButton: 'Custom',
      customTipLabel: 'Tip amount (S/)',
      customTipPlaceholder: '10.00',
      grandLabel: 'Table total',
      tableCaption: 'Bill split per person',
      colPerson: 'Person',
      colSubtotal: 'Subtotal',
      colTip: 'Tip',
      colTotal: 'Total',
      footTotal: 'Total',
      billEmpty: 'Add people to see the split.',
      adjustNote: 'Cents are adjusted so the per-person amounts add up exactly to the total.',
      waLabel: 'WhatsApp message',
      waEmpty: 'Add people to build the message.',
      copyButton: 'Copy for WhatsApp',
      copied: 'Copied!',
      copyFallback: 'Could not copy automatically. Select the message above and copy it by hand.',
      copyFailedStatus: 'Could not copy automatically.',
      footer: 'Split the bill · down to the cent.',
      noscript: 'Enable JavaScript to split the bill.',
      tipCustom: 'Custom tip',
      tipNone: 'No tip',
      tipPercent: 'Tip {percent}%',
      tipAmount: 'Tip {amount}',
      waTitle: 'Table bill 🍽️',
      waTotal: 'Total:',
      unnamed: 'No name',
      errPriceEmpty: 'Enter a price.',
      errPriceZero: 'The price must be greater than zero.',
      errPriceNegative: 'The price cannot be negative.',
      errAmountTooLarge: 'That amount is too large.',
      errPriceInvalid: 'That price is not valid. Example: 12.50.',
      errTipEmpty: 'Enter the tip amount.',
      errTipNegative: 'The tip cannot be negative.',
      errTipInvalid: 'That amount is not valid. Example: 5.00.',
      errPersonEmpty: 'Enter a name.',
      errNameTooLong: 'The name is too long.',
      errItemEmpty: 'Enter the dish or drink.'
    }
  };

  var MESSAGE_KEYS = {
    'price:empty': 'errPriceEmpty',
    'price:zero': 'errPriceZero',
    'price:negative': 'errPriceNegative',
    'price:too-large': 'errAmountTooLarge',
    'price:invalid': 'errPriceInvalid',
    'tip:empty': 'errTipEmpty',
    'tip:negative': 'errTipNegative',
    'tip:too-large': 'errAmountTooLarge',
    'tip:invalid': 'errTipInvalid',
    'person:empty': 'errPersonEmpty',
    'person:too-long': 'errNameTooLong',
    'item:empty': 'errItemEmpty',
    'item:too-long': 'errNameTooLong'
  };

  function normalizeLang(lang) {
    return lang === 'en' ? 'en' : 'es';
  }

  function t(lang, key, vars) {
    var language = normalizeLang(lang);
    var text = STRINGS[language][key];
    if (text == null) text = STRINGS.es[key];
    if (text == null) return key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_match, name) {
      return vars[name] == null ? '' : String(vars[name]);
    });
  }

  function messageFor(kind, code, lang) {
    var key = MESSAGE_KEYS[kind + ':' + code];
    if (!key) {
      if (kind === 'tip') key = 'errTipInvalid';
      else if (kind === 'item') key = 'errItemEmpty';
      else if (kind === 'person') key = 'errPersonEmpty';
      else key = 'errPriceInvalid';
    }
    return t(lang, key);
  }

  function fail(code, kind) {
    return {
      ok: false,
      code: code,
      message: messageFor(kind === 'tip' ? 'tip' : 'price', code, 'es')
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
    if (!name) return { ok: false, code: 'empty', message: messageFor('person', 'empty', 'es') };
    if (name.length > 60) return { ok: false, code: 'too-long', message: messageFor('person', 'too-long', 'es') };
    return { ok: true, name: name };
  }

  function validateItemName(raw) {
    var name = cleanName(raw);
    if (!name) return { ok: false, code: 'empty', message: messageFor('item', 'empty', 'es') };
    if (name.length > 80) return { ok: false, code: 'too-long', message: messageFor('item', 'too-long', 'es') };
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

  function buildWhatsAppMessage(bill, lang) {
    var language = normalizeLang(lang);
    var lines = [t(language, 'waTitle')];
    var rows = (bill && bill.rows) || [];
    for (var i = 0; i < rows.length; i += 1) {
      var name = cleanName(rows[i].name) || t(language, 'unnamed');
      lines.push(name + ': ' + formatSoles(rows[i].totalCents));
    }
    lines.push(t(language, 'waTotal') + ' ' + formatSoles(bill ? bill.totalCents : 0));
    return lines.join('\n');
  }

  return {
    STRINGS: STRINGS,
    t: t,
    messageFor: messageFor,
    parseAmountToCents: parseAmountToCents,
    validatePersonName: validatePersonName,
    validateItemName: validateItemName,
    calculateBill: calculateBill,
    formatSoles: formatSoles,
    centsToInput: centsToInput,
    buildWhatsAppMessage: buildWhatsAppMessage
  };
});
