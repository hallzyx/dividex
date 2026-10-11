(function () {
  'use strict';

  var DC = window.DivideCuenta;
  if (!DC) return;

  var AVATAR_COLORS = ['#c94b24', '#1f6b45', '#1d4e89', '#8a5a00', '#7a3050'];

  var state = {
    people: [],
    tipMode: 'percent',
    tipPercent: 10,
    customTipCents: 0,
    customTipError: '',
    editing: null,
    pendingDeletePersonId: null
  };

  var idCounter = 0;
  var copiedTimer = 0;
  var lastBill = null;

  var peopleEl = document.getElementById('people');
  var emptyEl = document.getElementById('empty-state');
  var personForm = document.getElementById('add-person-form');
  var personError = document.getElementById('person-error');
  var personNameInput = document.getElementById('person-name');
  var billBody = document.getElementById('bill-body');
  var sumSub = document.getElementById('sum-subtotal');
  var sumTip = document.getElementById('sum-tip');
  var sumTotal = document.getElementById('sum-total');
  var grandTotal = document.getElementById('grand-total');
  var receiptMeta = document.getElementById('receipt-meta');
  var waPreview = document.getElementById('wa-preview');
  var copyBtn = document.getElementById('copy-btn');
  var copyStatus = document.getElementById('copy-status');
  var copyFallback = document.getElementById('copy-fallback');
  var customWrap = document.getElementById('custom-tip-wrap');
  var customInput = document.getElementById('custom-tip');
  var customError = document.getElementById('custom-tip-error');
  var tipButtons = document.querySelectorAll('[data-tip]');

  function nextId(prefix) {
    idCounter += 1;
    return prefix + idCounter;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function findPerson(personId) {
    for (var i = 0; i < state.people.length; i += 1) {
      if (state.people[i].id === personId) return state.people[i];
    }
    return null;
  }

  function currentTip() {
    if (state.tipMode === 'custom') {
      return {
        type: 'custom',
        cents: state.customTipError ? 0 : state.customTipCents
      };
    }
    return { type: 'percent', percent: state.tipPercent };
  }

  function clearFormError(form) {
    if (!form) return;
    var box = form.querySelector('.field-error');
    if (box) box.textContent = '';
    var inputs = form.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i += 1) {
      inputs[i].removeAttribute('aria-invalid');
    }
  }

  function showFormError(form, message) {
    var box = form.querySelector('.field-error');
    if (box) box.textContent = message;
    var inputs = form.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i += 1) {
      inputs[i].setAttribute('aria-invalid', 'true');
    }
  }

  // Read controls with querySelector. form.elements.item is the collection's
  // item() method, so a field named "item" cannot be read that way.
  function field(form, name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function snapshotDrafts() {
    var drafts = {};
    var forms = peopleEl.querySelectorAll('form.add-item');
    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      drafts[form.getAttribute('data-person-id')] = {
        item: field(form, 'dish').value,
        price: field(form, 'price').value
      };
    }
    return drafts;
  }

  function tipLabel() {
    if (state.tipMode === 'custom') {
      if (state.customTipError || state.customTipCents <= 0) return 'Propina personalizada';
      return 'Propina ' + DC.formatSoles(state.customTipCents);
    }
    if (state.tipPercent === 0) return 'Sin propina';
    return 'Propina ' + state.tipPercent + '%';
  }

  function renderTipButtons() {
    for (var i = 0; i < tipButtons.length; i += 1) {
      var button = tipButtons[i];
      var value = button.getAttribute('data-tip');
      var pressed = state.tipMode === 'custom'
        ? value === 'custom'
        : value === String(state.tipPercent);
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    }
    if (state.tipMode === 'custom') customWrap.hidden = false;
    else customWrap.hidden = true;
    customError.textContent = state.tipMode === 'custom' ? state.customTipError : '';
  }

  function renderPeople(drafts) {
    if (state.people.length === 0) {
      peopleEl.innerHTML = '';
      emptyEl.hidden = false;
      return;
    }
    emptyEl.hidden = true;

    var html = '';
    for (var p = 0; p < state.people.length; p += 1) {
      html += personMarkup(state.people[p], p, drafts || {});
    }
    peopleEl.innerHTML = html;
  }

  function personMarkup(person, index, drafts) {
    var color = AVATAR_COLORS[index % AVATAR_COLORS.length];
    var initial = person.name.charAt(0).toUpperCase();
    var subtotal = 0;
    for (var s = 0; s < person.items.length; s += 1) subtotal += person.items[s].priceCents;

    var head;
    if (state.editing && state.editing.kind === 'person' && state.editing.personId === person.id) {
      head =
        '<form class="person-edit" data-action="save-person" data-person-id="' + person.id + '" novalidate>' +
          '<label class="sr-only" for="edit-name-' + person.id + '">Nombre</label>' +
          '<input id="edit-name-' + person.id + '" name="name" maxlength="60" value="' + escapeHtml(person.name) + '">' +
          '<button type="submit" class="btn btn-primary btn-small">Guardar</button>' +
          '<button type="button" class="btn btn-ghost btn-small" data-action="cancel-edit">Cancelar</button>' +
          '<p class="field-error" role="alert"></p>' +
        '</form>';
    } else if (state.pendingDeletePersonId === person.id) {
      head =
        '<div class="confirm-delete">' +
          '<p>¿Eliminar a ' + escapeHtml(person.name) + ' y todo lo que pidió?</p>' +
          '<button type="button" class="btn btn-danger btn-small" data-action="confirm-delete-person" data-person-id="' + person.id + '">Sí, eliminar</button>' +
          '<button type="button" class="btn btn-ghost btn-small" data-action="cancel-delete">Cancelar</button>' +
        '</div>';
    } else {
      head =
        '<div class="person-main">' +
          '<span class="avatar" style="background:' + color + '">' + escapeHtml(initial) + '</span>' +
          '<h3 class="person-name">' + escapeHtml(person.name) + '</h3>' +
        '</div>' +
        '<div class="person-actions">' +
          '<button type="button" class="btn btn-text" data-action="edit-person" data-person-id="' + person.id + '">Editar</button>' +
          '<button type="button" class="btn btn-text danger" data-action="delete-person" data-person-id="' + person.id + '">Eliminar</button>' +
        '</div>';
    }

    var items = '';
    if (person.items.length === 0) {
      items = '<li class="item-empty">Todavía no hay pedidos.</li>';
    } else {
      for (var i = 0; i < person.items.length; i += 1) {
        items += itemMarkup(person, person.items[i]);
      }
    }

    var draft = drafts[person.id] || { item: '', price: '' };

    return (
      '<article class="person" data-person-id="' + person.id + '">' +
        '<div class="person-head">' + head + '</div>' +
        '<ul class="items">' + items + '</ul>' +
        '<p class="person-sub">Subtotal <strong data-field="subtotal" data-cents="' + subtotal + '">' + DC.formatSoles(subtotal) + '</strong></p>' +
        '<form class="add-item" data-action="add-item" data-person-id="' + person.id + '" novalidate>' +
          '<div class="field">' +
            '<label for="item-' + person.id + '">Plato o bebida</label>' +
            '<input id="item-' + person.id + '" name="dish" maxlength="80" placeholder="Lomo saltado" value="' + escapeHtml(draft.item) + '">' +
          '</div>' +
          '<div class="field">' +
            '<label for="price-' + person.id + '">Precio (S/)</label>' +
            '<input id="price-' + person.id + '" name="price" inputmode="decimal" maxlength="12" placeholder="12.50" value="' + escapeHtml(draft.price) + '">' +
          '</div>' +
          '<button type="submit" class="btn btn-primary">Agregar</button>' +
          '<p class="field-error" role="alert"></p>' +
        '</form>' +
      '</article>'
    );
  }

  function itemMarkup(person, item) {
    if (state.editing && state.editing.kind === 'item' && state.editing.itemId === item.id) {
      return (
        '<li class="item item-editing">' +
          '<form class="edit-item" data-action="save-item" data-person-id="' + person.id + '" data-item-id="' + item.id + '" novalidate>' +
            '<div class="field">' +
              '<label class="sr-only" for="edit-item-' + item.id + '">Plato o bebida</label>' +
              '<input id="edit-item-' + item.id + '" name="dish" maxlength="80" value="' + escapeHtml(item.name) + '">' +
            '</div>' +
            '<div class="field">' +
              '<label class="sr-only" for="edit-price-' + item.id + '">Precio (S/)</label>' +
              '<input id="edit-price-' + item.id + '" name="price" inputmode="decimal" maxlength="12" value="' + escapeHtml(DC.centsToInput(item.priceCents)) + '">' +
            '</div>' +
            '<button type="submit" class="btn btn-primary btn-small">Guardar</button>' +
            '<button type="button" class="btn btn-ghost btn-small" data-action="cancel-edit">Cancelar</button>' +
            '<p class="field-error" role="alert"></p>' +
          '</form>' +
        '</li>'
      );
    }

    return (
      '<li class="item">' +
        '<span class="item-name">' + escapeHtml(item.name) + '</span>' +
        '<span class="item-price">' + DC.formatSoles(item.priceCents) + '</span>' +
        '<button type="button" class="btn btn-text" data-action="edit-item" data-person-id="' + person.id + '" data-item-id="' + item.id + '">Editar</button>' +
        '<button type="button" class="btn btn-text danger" data-action="delete-item" data-person-id="' + person.id + '" data-item-id="' + item.id + '" aria-label="Eliminar ' + escapeHtml(item.name) + '">Eliminar</button>' +
      '</li>'
    );
  }

  function renderSummary() {
    lastBill = DC.calculateBill(state.people, currentTip());
    var bill = lastBill;
    receiptMeta.textContent = tipLabel();

    if (bill.rows.length === 0) {
      billBody.innerHTML = '<tr class="bill-empty"><td colspan="4">Agrega personas para ver el reparto.</td></tr>';
    } else {
      var rows = '';
      for (var i = 0; i < bill.rows.length; i += 1) {
        var row = bill.rows[i];
        rows +=
          '<tr data-name="' + escapeHtml(row.name) + '" data-subtotal-cents="' + row.subtotalCents + '" data-tip-cents="' + row.tipCents + '" data-total-cents="' + row.totalCents + '">' +
            '<th scope="row">' + escapeHtml(row.name) + '</th>' +
            '<td>' + DC.formatSoles(row.subtotalCents) + '</td>' +
            '<td>' + DC.formatSoles(row.tipCents) + '</td>' +
            '<td class="total-cell">' + DC.formatSoles(row.totalCents) + '</td>' +
          '</tr>';
      }
      billBody.innerHTML = rows;
    }

    sumSub.textContent = DC.formatSoles(bill.subtotalCents);
    sumTip.textContent = DC.formatSoles(bill.tipCents);
    sumTotal.textContent = DC.formatSoles(bill.totalCents);
    grandTotal.textContent = DC.formatSoles(bill.totalCents);
    grandTotal.dataset.totalCents = String(bill.totalCents);
    sumTotal.dataset.totalCents = String(bill.totalCents);

    if (bill.rows.length === 0) {
      waPreview.textContent = 'Agrega personas para armar el mensaje.';
      copyBtn.disabled = true;
    } else {
      waPreview.textContent = DC.buildWhatsAppMessage(bill);
      copyBtn.disabled = false;
    }
  }

  function refresh(drafts) {
    renderPeople(drafts);
    renderTipButtons();
    renderSummary();
  }

  function focusAddItem(personId) {
    var input = document.getElementById('item-' + personId);
    if (input) input.focus();
  }

  personForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var result = DC.validatePersonName(personNameInput.value);
    if (!result.ok) {
      personError.textContent = result.message;
      personNameInput.setAttribute('aria-invalid', 'true');
      personNameInput.focus();
      return;
    }
    personError.textContent = '';
    personNameInput.removeAttribute('aria-invalid');
    var person = { id: nextId('p'), name: result.name, items: [] };
    state.people.push(person);
    personNameInput.value = '';
    refresh();
    focusAddItem(person.id);
  });

  personNameInput.addEventListener('input', function () {
    personError.textContent = '';
    personNameInput.removeAttribute('aria-invalid');
  });

  peopleEl.addEventListener('input', function (event) {
    var form = event.target.closest('form');
    if (form) clearFormError(form);
  });

  peopleEl.addEventListener('submit', function (event) {
    var form = event.target;
    var action = form.getAttribute('data-action');
    if (!action) return;
    event.preventDefault();

    if (action === 'add-item') addItem(form);
    else if (action === 'save-person') savePerson(form);
    else if (action === 'save-item') saveItem(form);
  });

  peopleEl.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button || !peopleEl.contains(button)) return;
    var action = button.getAttribute('data-action');
    if (!action) return;

    if (action === 'edit-person') {
      var drafts = snapshotDrafts();
      state.pendingDeletePersonId = null;
      state.editing = { kind: 'person', personId: button.getAttribute('data-person-id') };
      refresh(drafts);
      var nameInput = document.getElementById('edit-name-' + button.getAttribute('data-person-id'));
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
      return;
    }

    if (action === 'delete-person') {
      state.editing = null;
      state.pendingDeletePersonId = button.getAttribute('data-person-id');
      refresh(snapshotDrafts());
      return;
    }

    if (action === 'confirm-delete-person') {
      var removeId = button.getAttribute('data-person-id');
      state.people = state.people.filter(function (person) { return person.id !== removeId; });
      state.pendingDeletePersonId = null;
      state.editing = null;
      refresh();
      return;
    }

    if (action === 'cancel-delete' || action === 'cancel-edit') {
      state.pendingDeletePersonId = null;
      state.editing = null;
      refresh(snapshotDrafts());
      return;
    }

    if (action === 'edit-item') {
      var draftsForItem = snapshotDrafts();
      state.pendingDeletePersonId = null;
      state.editing = {
        kind: 'item',
        personId: button.getAttribute('data-person-id'),
        itemId: button.getAttribute('data-item-id')
      };
      refresh(draftsForItem);
      var itemInput = document.getElementById('edit-item-' + button.getAttribute('data-item-id'));
      if (itemInput) {
        itemInput.focus();
        itemInput.select();
      }
      return;
    }

    if (action === 'delete-item') {
      var owner = findPerson(button.getAttribute('data-person-id'));
      if (!owner) return;
      var itemId = button.getAttribute('data-item-id');
      owner.items = owner.items.filter(function (item) { return item.id !== itemId; });
      if (state.editing && state.editing.itemId === itemId) state.editing = null;
      refresh(snapshotDrafts());
    }
  });

  peopleEl.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !state.editing) return;
    state.editing = null;
    refresh(snapshotDrafts());
  });

  function addItem(form) {
    var person = findPerson(form.getAttribute('data-person-id'));
    if (!person) return;
    var nameResult = DC.validateItemName(field(form, 'dish').value);
    if (!nameResult.ok) {
      showFormError(form, nameResult.message);
      field(form, 'dish').focus();
      return;
    }
    var priceResult = DC.parseAmountToCents(field(form, 'price').value, { allowZero: false, kind: 'price' });
    if (!priceResult.ok) {
      showFormError(form, priceResult.message);
      field(form, 'price').focus();
      return;
    }
    person.items.push({
      id: nextId('i'),
      name: nameResult.name,
      priceCents: priceResult.cents
    });
    var drafts = snapshotDrafts();
    delete drafts[person.id];
    state.editing = null;
    refresh(drafts);
    focusAddItem(person.id);
  }

  function savePerson(form) {
    var person = findPerson(form.getAttribute('data-person-id'));
    if (!person) return;
    var result = DC.validatePersonName(field(form, 'name').value);
    if (!result.ok) {
      showFormError(form, result.message);
      field(form, 'name').focus();
      return;
    }
    person.name = result.name;
    state.editing = null;
    refresh(snapshotDrafts());
  }

  function saveItem(form) {
    var person = findPerson(form.getAttribute('data-person-id'));
    if (!person) return;
    var itemId = form.getAttribute('data-item-id');
    var item = null;
    for (var i = 0; i < person.items.length; i += 1) {
      if (person.items[i].id === itemId) item = person.items[i];
    }
    if (!item) return;
    var nameResult = DC.validateItemName(field(form, 'dish').value);
    if (!nameResult.ok) {
      showFormError(form, nameResult.message);
      field(form, 'dish').focus();
      return;
    }
    var priceResult = DC.parseAmountToCents(field(form, 'price').value, { allowZero: false, kind: 'price' });
    if (!priceResult.ok) {
      showFormError(form, priceResult.message);
      field(form, 'price').focus();
      return;
    }
    item.name = nameResult.name;
    item.priceCents = priceResult.cents;
    state.editing = null;
    refresh(snapshotDrafts());
  }

  for (var b = 0; b < tipButtons.length; b += 1) {
    tipButtons[b].addEventListener('click', function (event) {
      var value = event.currentTarget.getAttribute('data-tip');
      if (value === 'custom') state.tipMode = 'custom';
      else {
        state.tipMode = 'percent';
        state.tipPercent = Number(value);
      }
      renderTipButtons();
      renderSummary();
      if (value === 'custom') customInput.focus();
    });
  }

  customInput.addEventListener('input', function () {
    var raw = customInput.value;
    if (raw.trim() === '') {
      state.customTipCents = 0;
      state.customTipError = '';
    } else {
      var parsed = DC.parseAmountToCents(raw, { allowZero: true, kind: 'tip' });
      if (!parsed.ok) {
        state.customTipCents = 0;
        state.customTipError = parsed.message;
      } else {
        state.customTipCents = parsed.cents;
        state.customTipError = '';
      }
    }
    customError.textContent = state.customTipError;
    renderSummary();
  });

  function showCopied() {
    copyBtn.classList.add('is-copied');
    copyBtn.textContent = '¡Copiado!';
    copyStatus.textContent = '¡Copiado!';
    copyFallback.hidden = true;
    window.clearTimeout(copiedTimer);
    copiedTimer = window.setTimeout(resetCopyButton, 2600);
  }

  function resetCopyButton() {
    copyBtn.classList.remove('is-copied');
    copyBtn.textContent = 'Copiar para WhatsApp';
    copyStatus.textContent = '';
  }

  function fallbackCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.width = '1px';
    area.style.height = '1px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () {
        return true;
      }).catch(function () {
        return fallbackCopy(text);
      });
    }
    return Promise.resolve(fallbackCopy(text));
  }

  copyBtn.addEventListener('click', function () {
    if (!lastBill || lastBill.rows.length === 0) return;
    var text = DC.buildWhatsAppMessage(lastBill);
    copyText(text).then(function (ok) {
      if (ok) {
        showCopied();
        return;
      }
      resetCopyButton();
      copyFallback.hidden = false;
      copyStatus.textContent = 'No se pudo copiar automáticamente.';
    });
  });

  refresh();
})();
