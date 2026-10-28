(function () {
  'use strict';

  var FAVORITES_KEY = 'mapa-escuelas-la-raiz-v2-favorites';
  var FAVORITES_ONLY_KEY = 'mapa-escuelas-la-raiz-v2-favorites-only';
  var favorites = new Set();
  var favoritesOnly = false;
  var noticeTimer = null;

  try {
    favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'));
    favoritesOnly = localStorage.getItem(FAVORITES_ONLY_KEY) === 'true';
  } catch (_) {}

  function recordKey(properties) {
    var p = properties || {};
    return String(p._markerKey || p.cueanexo || p.clave || p.cui || [p.nombre, p.numero, p.localidad, p.nivel].join('|'));
  }

  function persistFavorites() {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites))); } catch (_) {}
  }

  function updateFavoriteControls() {
    var filterButton = document.getElementById('favoritesFilterBtn');
    var count = document.getElementById('favoritesCount');
    if (count) count.textContent = String(favorites.size);
    if (filterButton) {
      filterButton.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
      filterButton.title = favoritesOnly ? 'Mostrar todas las escuelas' : 'Mostrar solo las escuelas favoritas';
    }
    document.querySelectorAll('[data-school-favorite]').forEach(function (button) {
      var active = favorites.has(button.getAttribute('data-school-favorite'));
      button.classList.toggle('is-favorite', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.textContent = active ? '★ Guardada' : '☆ Guardar escuela';
    });
  }

  function showNotice(message) {
    var notice = document.getElementById('appNotice');
    if (!notice) return;
    notice.textContent = message;
    notice.classList.add('visible');
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { notice.classList.remove('visible'); }, 2300);
  }

  function addressFor(properties) {
    var p = properties || {};
    return String(p.direccion || p.dirección || p.domicilio || p.calle || p.ubicacion || p['Dirección'] || '').trim();
  }

  function makeSchoolActions(root, properties) {
    if (!root || !properties || properties.tipo_lugar === 'lugar_interes_docente') return;
    var frame = root.querySelector('.popup-frame');
    if (!frame || frame.querySelector('.school-actions')) return;

    var key = recordKey(properties);
    var actions = document.createElement('div');
    actions.className = 'school-actions';
    actions.setAttribute('aria-label', 'Acciones de la escuela');

    var menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'school-menu-btn';
    menuButton.textContent = '⋯';
    menuButton.title = 'Guardar, copiar dirección y cómo llegar';
    menuButton.setAttribute('aria-haspopup', 'true');
    menuButton.setAttribute('aria-expanded', 'false');
    actions.appendChild(menuButton);

    var menu = document.createElement('div');
    menu.className = 'school-menu';
    menu.setAttribute('role', 'menu');
    actions.appendChild(menu);

    function closeMenu() {
      menu.classList.remove('open');
      menuButton.setAttribute('aria-expanded', 'false');
    }
    menuButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.addEventListener('click', function (event) { event.stopPropagation(); });

    var favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.setAttribute('role', 'menuitem');
    favoriteButton.setAttribute('data-school-favorite', key);
    favoriteButton.setAttribute('aria-pressed', favorites.has(key) ? 'true' : 'false');
    favoriteButton.className = favorites.has(key) ? 'is-favorite' : '';
    favoriteButton.textContent = favorites.has(key) ? '★ Guardada' : '☆ Guardar escuela';
    favoriteButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
      persistFavorites();
      updateFavoriteControls();
      if (typeof window.filterSchools === 'function') window.filterSchools();
      showNotice(favorites.has(key) ? 'Escuela guardada en favoritos' : 'Escuela quitada de favoritos');
    });
    menu.appendChild(favoriteButton);

    var address = addressFor(properties);
    var latitude = Number(properties._lat != null ? properties._lat : properties.latitud);
    var longitude = Number(properties._lng != null ? properties._lng : (properties.longitud != null ? properties.longitud : properties.lng));

    var copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.setAttribute('role', 'menuitem');
    copyButton.textContent = 'Copiar dirección';
    copyButton.disabled = !address;
    copyButton.title = address ? 'Copiar la dirección de la escuela' : 'Esta ficha no incluye una dirección';
    copyButton.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      if (!address) return;
      function copied() { showNotice('Dirección copiada'); }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(copied).catch(function () { fallbackCopy(address, copied); });
      } else fallbackCopy(address, copied);
    });
    menu.appendChild(copyButton);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      var directions = document.createElement('a');
      directions.setAttribute('role', 'menuitem');
      directions.textContent = 'Cómo llegar';
      directions.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(latitude + ',' + longitude);
      directions.target = '_blank';
      directions.rel = 'noopener noreferrer';
      directions.setAttribute('aria-label', 'Abrir indicaciones para llegar a esta escuela');
      directions.addEventListener('click', closeMenu);
      menu.appendChild(directions);
    }

    // Hijo del marco, no de .frame-content: así no se mezcla con los datos de la pizarra.
    var backButton = frame.querySelector('.popup-volver-btn');
    frame.insertBefore(actions, backButton || null);
  }

  function fallbackCopy(text, done) {
    var field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    try { document.execCommand('copy'); done(); } catch (_) { showNotice('No se pudo copiar la dirección'); }
    field.remove();
  }

  // Los toques dentro del desplegable se detienen arriba; esto cubre el resto de la pantalla.
  document.addEventListener('click', function () {
    document.querySelectorAll('.school-menu.open').forEach(function (openMenu) {
      openMenu.classList.remove('open');
      var button = openMenu.parentNode && openMenu.parentNode.querySelector('.school-menu-btn');
      if (button) button.setAttribute('aria-expanded', 'false');
    });
  });

  var originalWire = window.wirePopupInteractions;
  if (typeof originalWire === 'function') {
    window.wirePopupInteractions = function (root, properties, isOverlay) {
      var result = originalWire.apply(this, arguments);
      makeSchoolActions(root, properties);
      return result;
    };
  }

  var originalGetBaseFeatures = window.getBaseFeatures;
  if (typeof originalGetBaseFeatures === 'function') {
    window.getBaseFeatures = function () {
      var features = originalGetBaseFeatures.apply(this, arguments);
      if (!favoritesOnly) return features;
      return features.filter(function (feature) { return favorites.has(recordKey(feature.properties)); });
    };
  }

  function renderFilterSummary() {
    var summary = document.getElementById('activeFilterSummary');
    if (!summary) return;
    summary.replaceChildren();
    var chips = [];
    var search = document.getElementById('searchInput');
    var district = document.getElementById('filterDistrito');
    var locality = document.getElementById('filterLocalidad');
    var disadvantage = document.getElementById('filterDesfavorabilidad');
    var levelAll = document.getElementById('levelAll');
    var levels = Array.from(document.querySelectorAll('.levelCheck'));

    if (search && search.value.trim()) chips.push(['Búsqueda: ' + search.value.trim(), 'search']);
    if (district && district.value) chips.push([district.value, 'district']);
    if (locality && locality.value) chips.push([locality.options[locality.selectedIndex].textContent, 'locality']);
    if (disadvantage && disadvantage.value) chips.push(['Desfav.: ' + disadvantage.value, 'disadvantage']);
    if (levelAll && !levelAll.checked) {
      var selectedCount = levels.filter(function (level) { return level.checked; }).length;
      if (selectedCount !== levels.length) chips.push(['Niveles: ' + selectedCount + '/' + levels.length, 'levels']);
    }
    if (favoritesOnly) chips.push(['Solo favoritas', 'favorites']);

    chips.forEach(function (chip) {
      var item = document.createElement('span');
      item.className = 'filter-chip';
      item.appendChild(document.createTextNode(chip[0]));
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Quitar filtro: ' + chip[0]);
      remove.addEventListener('click', function () { clearFilter(chip[1]); });
      item.appendChild(remove);
      summary.appendChild(item);
    });
  }

  function clearFilter(name) {
    var search = document.getElementById('searchInput');
    var district = document.getElementById('filterDistrito');
    var locality = document.getElementById('filterLocalidad');
    var disadvantage = document.getElementById('filterDesfavorabilidad');
    if (name === 'search' && search) search.value = '';
    if (name === 'district' && district) district.value = '';
    if ((name === 'district' || name === 'locality') && locality) locality.value = '';
    if (name === 'disadvantage' && disadvantage) disadvantage.value = '';
    if (name === 'levels') {
      document.querySelectorAll('.levelCheck').forEach(function (level) { level.checked = true; });
      var levelAll = document.getElementById('levelAll');
      if (levelAll) levelAll.checked = true;
      if (typeof window.updateLevelsBadgeCount === 'function') window.updateLevelsBadgeCount();
    }
    if (name === 'favorites') {
      favoritesOnly = false;
      try { localStorage.setItem(FAVORITES_ONLY_KEY, 'false'); } catch (_) {}
      updateFavoriteControls();
    }
    if (name === 'district' && typeof window.populateLocalities === 'function') window.populateLocalities();
    if (typeof window.filterSchools === 'function') window.filterSchools();
    renderFilterSummary();
  }

  function bindEnhancements() {
    var favoriteFilter = document.getElementById('favoritesFilterBtn');
    var reset = document.getElementById('resetFiltersBtn');
    var summary = document.getElementById('activeFilterSummary');
    var controls = ['searchInput', 'filterDistrito', 'filterLocalidad', 'filterDesfavorabilidad'];

    if (favoriteFilter) favoriteFilter.addEventListener('click', function () {
      favoritesOnly = !favoritesOnly;
      try { localStorage.setItem(FAVORITES_ONLY_KEY, String(favoritesOnly)); } catch (_) {}
      updateFavoriteControls();
      if (typeof window.filterSchools === 'function') window.filterSchools();
      renderFilterSummary();
      if (favoritesOnly && favorites.size === 0) showNotice('Todavía no guardaste escuelas favoritas');
    });

    if (reset) reset.addEventListener('click', function () {
      var search = document.getElementById('searchInput');
      var district = document.getElementById('filterDistrito');
      var locality = document.getElementById('filterLocalidad');
      var disadvantage = document.getElementById('filterDesfavorabilidad');
      if (search) search.value = '';
      if (district) district.value = '';
      if (locality) locality.value = '';
      if (disadvantage) disadvantage.value = '';
      document.querySelectorAll('.levelCheck').forEach(function (level) { level.checked = true; });
      var levelAll = document.getElementById('levelAll');
      if (levelAll) levelAll.checked = true;
      favoritesOnly = false;
      try { localStorage.setItem(FAVORITES_ONLY_KEY, 'false'); } catch (_) {}
      updateFavoriteControls();
      if (typeof window.populateLocalities === 'function') window.populateLocalities();
      if (typeof window.updateLevelsBadgeCount === 'function') window.updateLevelsBadgeCount();
      if (typeof window.filterSchools === 'function') window.filterSchools();
      renderFilterSummary();
      showNotice('Filtros restablecidos');
    });

    controls.forEach(function (id) {
      var control = document.getElementById(id);
      if (!control) return;
      control.addEventListener('input', renderFilterSummary);
      control.addEventListener('change', renderFilterSummary);
    });
    document.addEventListener('change', function (event) {
      if (event.target && (event.target.matches('.levelCheck') || event.target.id === 'levelAll')) renderFilterSummary();
    });
    document.addEventListener('click', function (event) {
      if (event.target && event.target.closest('[data-school-favorite]')) {
        setTimeout(function () { renderFilterSummary(); }, 0);
      }
    });

    updateFavoriteControls();
    renderFilterSummary();
  }

  var notice = document.createElement('div');
  notice.id = 'appNotice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  document.body.appendChild(notice);
  bindEnhancements();
  window.addEventListener('load', function () { updateFavoriteControls(); renderFilterSummary(); });
}());
