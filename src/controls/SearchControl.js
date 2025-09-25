import { Control } from './Control.js';
import { AtlasMarker } from '../core/AtlasMarker.js';
import { EASING } from '../utils/constants.js';

// Search provider base and Nominatim provider (with retry/backoff and email param)
export class SearchProvider {
  constructor(options = {}) { this.options = options || {}; }
  async search(query) { throw new Error('search() must be implemented'); }
  formatResult(result) { throw new Error('formatResult() must be implemented'); }
  getBoundingBox(result) { return null; }
}
export class NominatimProvider extends SearchProvider {
  constructor(options = {}) {
    super(options);
    this.options = { format: 'json', limit: 5, email: options.email || '', ...options };
    this._cache = new Map();
  }
  async _fetchWithTimeout(url, timeout = 8000, retries = 2) {
    let attempt = 0;
    const doFetch = async (delay = 0) => {
      if (delay) await new Promise(r => setTimeout(r, delay));
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
        clearTimeout(id);
        if (res.status === 429 || res.status === 503) {
          if (attempt < retries) {
            attempt++;
            const backoff = Math.pow(2, attempt) * 200 + Math.random() * 200;
            return doFetch(backoff);
          } else {
            throw new Error('Rate limited');
          }
        }
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      } catch (err) {
        clearTimeout(id);
        if (err.name === 'AbortError') throw err;
        if (attempt < retries) {
          attempt++;
          const backoff = Math.pow(2, attempt) * 200 + Math.random() * 200;
          return doFetch(backoff);
        }
        throw err;
      }
    };
    return doFetch();
  }
  async search(query) {
    if (!query) return [];
    if (this._cache.has(query)) return this._cache.get(query);
    const params = { q: query, format: this.options.format, limit: this.options.limit };
    if (this.options.email) params.email = this.options.email;
    const queryString = new URLSearchParams(params).toString();
    const url = `https://nominatim.openstreetmap.org/search?${queryString}`;
    const data = await this._fetchWithTimeout(url, 8000, 2);
    this._cache.set(query, data);
    return data;
  }
  formatResult(result) {
    return {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name || `${result.lat}, ${result.lon}`,
        type: result.type,
        osm_id: result.osm_id,
        osm_type: result.osm_type
    };
  }
  getBoundingBox(result) {
    if (!result.boundingbox || result.boundingbox.length !== 4) return null;
    return {
        sw: { lat: parseFloat(result.boundingbox[0]), lon: parseFloat(result.boundingbox[2]) },
        ne: { lat: parseFloat(result.boundingbox[1]), lon: parseFloat(result.boundingbox[3]) }
    };
  }
}
// Search control - Enhanced with marker icons and fly-to with popup
export class SearchControl extends Control {
  constructor(options = {}) {
    super(options);
    this.options = {
      position: options.position || 'top-left',
      placeholder: options.placeholder || 'Search for a place...',
      noResultsMessage: options.noResultsMessage || 'No results found.',
      messageHideDelay: options.messageHideDelay || 3000,
      provider: options.provider || new NominatimProvider(options.providerOptions || {}),
      providerOptions: options.providerOptions || {}
    };
    this._input = null;
    this._resultsContainer = null;
    this._messageContainer = null;
    this._liveRegion = null;
    this._activeResultIndex = -1;
    this._currentResults = [];
    this._debounceTimer = null;
    this._abortController = null;
    this._resultItemCleanup = [];
    this._onInputChangeBound = this._onInputChange.bind(this);
    this._onInputKeyDownBound = this._onInputKeyDown.bind(this);
    this._onDocumentClickBound = this._onDocumentClick.bind(this);
    this._activeMarker = null; // Track the currently active marker for cleanup
  }
  onAdd() {
    const container = document.createElement('div');
    container.className = 'atlas-search-control';
    const form = document.createElement('form');
    form.className = 'atlas-search-form';
    form.style.display = 'flex';
    form.style.position = 'relative';
    form.setAttribute('role', 'search');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'atlas-search-input';
    input.placeholder = this.options.placeholder;
    input.setAttribute('aria-label', this.options.placeholder);
    input.style.padding = '6px 8px';
    input.style.fontSize = '14px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px 0 0 4px';
    input.style.outline = 'none';
    input.style.width = '200px';
    input.style.backgroundColor = 'rgba(255,255,255,0.9)';
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'atlas-search-submit';
    submitButton.setAttribute('aria-label', 'Search');
    submitButton.innerHTML = '🔍';
    submitButton.style.padding = '6px 8px';
    submitButton.style.border = '1px solid #ccc';
    submitButton.style.borderLeft = 'none';
    submitButton.style.borderRadius = '0 4px 4px 0';
    submitButton.style.background = 'rgba(255,255,255,0.9)';
    submitButton.style.cursor = 'pointer';
    submitButton.style.fontSize = '14px';
    submitButton.onmouseenter = () => { submitButton.style.background = 'rgba(240,240,240,0.95)'; };
    submitButton.onmouseleave = () => { submitButton.style.background = 'rgba(255,255,255,0.9)'; };
    form.appendChild(input);
    form.appendChild(submitButton);
    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'atlas-search-results';
    resultsContainer.style.position = 'absolute';
    resultsContainer.style.top = '100%';
    resultsContainer.style.left = '0';
    resultsContainer.style.right = '0';
    resultsContainer.style.zIndex = '1001';
    resultsContainer.style.backgroundColor = 'rgba(255,255,255,0.95)';
    resultsContainer.style.border = '1px solid #ccc';
    resultsContainer.style.borderTop = 'none';
    resultsContainer.style.borderRadius = '0 0 4px 4px';
    resultsContainer.style.maxHeight = '200px';
    resultsContainer.style.overflowY = 'auto';
    resultsContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.15)';
    resultsContainer.style.display = 'none';
    const messageContainer = document.createElement('div');
    messageContainer.className = 'atlas-search-message';
    messageContainer.style.position = 'absolute';
    messageContainer.style.top = '100%';
    messageContainer.style.left = '0';
    messageContainer.style.right = '0';
    messageContainer.style.zIndex = '1001';
    messageContainer.style.backgroundColor = 'rgba(255,255,255,0.95)';
    messageContainer.style.border = '1px solid #ccc';
    messageContainer.style.borderTop = 'none';
    messageContainer.style.borderRadius = '0 0 4px 4px';
    messageContainer.style.padding = '6px 8px';
    messageContainer.style.fontSize = '12px';
    messageContainer.style.color = '#666';
    messageContainer.style.textAlign = 'center';
    messageContainer.style.display = 'none';
    const liveRegion = document.createElement('div');
    liveRegion.className = 'sr-only';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('role', 'status');
    container.appendChild(form);
    container.appendChild(resultsContainer);
    container.appendChild(messageContainer);
    container.appendChild(liveRegion);
    this._container = container;
    this._input = input;
    this._resultsContainer = resultsContainer;
    this._messageContainer = messageContainer;
    this._liveRegion = liveRegion;
    const onSubmit = (e) => { e.preventDefault(); this._performSearch(this._input.value.trim()); };
    form.addEventListener('submit', onSubmit);
    this._addDomListener(form, 'submit', onSubmit);
    this._input.addEventListener('input', this._onInputChangeBound);
    this._addDomListener(this._input, 'input', this._onInputChangeBound);
    this._input.addEventListener('keydown', this._onInputKeyDownBound);
    this._addDomListener(this._input, 'keydown', this._onInputKeyDownBound);
    document.addEventListener('click', this._onDocumentClickBound);
    this._domListeners.push({ el: document, type: 'click', handler: this._onDocumentClickBound, options: false });
    return container;
  }
  onRemove() {
    if (this._abortController) { this._abortController.abort(); this._abortController = null; }
    if (this._input) {
      this._input.removeEventListener('input', this._onInputChangeBound);
      this._input.removeEventListener('keydown', this._onInputKeyDownBound);
    }
    document.removeEventListener('click', this._onDocumentClickBound);
    if (this._resultItemCleanup) {
      this._resultItemCleanup.forEach(cleanup => cleanup());
      this._resultItemCleanup = [];
    }
    if (this._debounceTimer) { clearTimeout(this._debounceTimer); this._debounceTimer = null; }
    if (this._resultsContainer) this._resultsContainer.style.display = 'none';
    if (this._messageContainer) this._messageContainer.style.display = 'none';
    // Clean up active marker if exists
    if (this._activeMarker) {
      this._activeMarker.remove();
      this._activeMarker = null;
    }
    // remove stored DOM listeners
    this._removeDomListeners();
  }
  _onDocumentClick(event) { if (!this._container.contains(event.target)) { this._hideResults(); this._hideMessage(); } }
  _onInputChange(event) {
    const query = event.target.value.trim();
    if (query.length === 0) { this._hideResults(); this._hideMessage(); return; }
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._performSearch(query), 300);
  }
  _onInputKeyDown(event) {
    const key = event.key;
    if (key === 'ArrowDown') { event.preventDefault(); this._activeResultIndex = Math.min(this._activeResultIndex + 1, this._currentResults.length - 1); this._updateResultHighlight(); }
    else if (key === 'ArrowUp') { event.preventDefault(); this._activeResultIndex = Math.max(this._activeResultIndex - 1, -1); this._updateResultHighlight(); }
    else if (key === 'Enter' && this._activeResultIndex >= 0) { event.preventDefault(); this._selectResult(this._currentResults[this._activeResultIndex]); }
    else if (key === 'Escape') { this._input.blur(); this._hideResults(); this._hideMessage(); }
  }
  _updateResultHighlight() {
    const resultItems = this._resultsContainer.querySelectorAll('.atlas-search-result-item');
    resultItems.forEach(item => item.classList.remove('active'));
    if (this._activeResultIndex >= 0 && resultItems[this._activeResultIndex]) resultItems[this._activeResultIndex].classList.add('active');
  }
  _performSearch(query) {
    if (!query) return;
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    this._showMessage('Searching...');
    this.options.provider.search(query)
      .then(data => {
        if (this._abortController.signal.aborted) return;
        this._hideMessage();
        this._displayResults(data);
      })
      .catch(error => {
        if (error.name === 'AbortError') return;
        this._showMessage('Search error');
        setTimeout(() => this._hideMessage(), 1500);
      });
  }
  _displayResults(results) {
    this._currentResults = results;
    this._activeResultIndex = -1;
    if (this._resultItemCleanup) { this._resultItemCleanup.forEach(cleanup => cleanup()); this._resultItemCleanup = []; }
    if (!results || results.length === 0) {
      this._liveRegion.textContent = this.options.noResultsMessage;
      this._showMessage(this.options.noResultsMessage);
      this._hideResults();
      return;
    }
    this._liveRegion.textContent = `${results.length} search results available.`;
    this._resultsContainer.innerHTML = '';
    results.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'atlas-search-result-item';
      item.style.padding = '8px 10px';
      item.style.cursor = 'pointer';
      item.style.borderBottom = '1px solid #eee';
      item.style.fontSize = '13px';
      item.tabIndex = 0;
      const onMouseEnter = () => { this._activeResultIndex = index; this._updateResultHighlight(); };
      const onClick = () => { this._selectResult(result); };
      const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this._selectResult(result);
        }
      };
      item.onmouseenter = onMouseEnter;
      item.onclick = onClick;
      item.onkeydown = onKeyDown;
      const formatted = this.options.provider.formatResult(result);

      // Create a container for the marker icon and text
      const markerIconContainer = document.createElement('div');
      markerIconContainer.style.display = 'flex';
      markerIconContainer.style.alignItems = 'center';
      markerIconContainer.style.gap = '8px'; // Space between icon and text

      // Create the marker icon element (using the same SVG as AtlasMarker)
      const markerIcon = document.createElement('div');
      markerIcon.className = 'search-marker-icon';
      markerIcon.innerHTML = `
            <svg width="16" height="24" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0zm0 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" fill="#d50000"/>
              <circle cx="12" cy="12" r="2" fill="#ffffff"/>
            </svg>
          `;

      // Create a text element for the display name
      const textSpan = document.createElement('span');
      textSpan.textContent = formatted.displayName;

      // Assemble the item content
      markerIconContainer.appendChild(markerIcon);
      markerIconContainer.appendChild(textSpan);
      item.appendChild(markerIconContainer);

      this._resultsContainer.appendChild(item);
      this._resultItemCleanup.push(() => {
        item.onmouseenter = null;
        item.onclick = null;
        item.onkeydown = null;
      });
    });
    const lastItem = this._resultsContainer.lastElementChild;
    if (lastItem) lastItem.style.borderBottom = 'none';
    this._resultsContainer.style.display = 'block';
  }
  _selectResult(result) {
    if (!result || !this._map) return;
    const formatted = this.options.provider.formatResult(result);
    const lat = parseFloat(formatted.lat);
    const lon = parseFloat(formatted.lng);
    if (isNaN(lat) || isNaN(lon)) { return; }

    // Clean up previous marker if exists
    if (this._activeMarker) {
      this._activeMarker.remove();
    }

    // Create a new AtlasMarker at the selected location
    const newMarker = new AtlasMarker({ lat: lat, lon: lon }, {
        title: formatted.displayName
    }).addTo(this._map);

    // Bind and open a popup with the location name
    newMarker.bindPopup(`
            <h4>${formatted.displayName}</h4>
            <p>Type: ${formatted.type}</p>
            <a href="https://www.openstreetmap.org/${formatted.osm_type}/${formatted.osm_id}" target="_blank">View on OSM</a>
        `).openPopup();

    // Store reference to active marker for cleanup
    this._activeMarker = newMarker;

    const boundingBox = this.options.provider.getBoundingBox(result);

    if (boundingBox) {
        this._map.fitBounds(boundingBox, {
            padding: 0.1,
            duration: 800,
            easing: EASING.easeInOutQuint
        });
    } else {
        // Fly to the location
        this._liveRegion.textContent = `Navigating to ${formatted.displayName}.`;
        if (typeof this._map.flyToQuick === 'function') {
            this._map.flyToQuick({
                center: { lat: lat, lon: lon },
                zoom: 14,
                duration: 420,
                easing: EASING.easeInOutQuint
            });
        } else {
            this._map.flyTo({
                center: { lat: lat, lon: lon },
                zoom: 14,
                duration: 420,
                easing: EASING.easeInOutQuint
            });
        }
    }

    // Clear the search input and hide results
    this._input.value = '';
    this._hideResults();
    this._hideMessage();

    // Fire the select event
    this.fire('search:select', { result: formatted, latlng: { lat: lat, lon: lon } });
  }
  _showMessage(text) {
    this._hideResults();
    this._liveRegion.textContent = text;
    this._messageContainer.textContent = text;
    this._messageContainer.style.display = 'block';
    setTimeout(() => { this._hideMessage(); }, this.options.messageHideDelay);
  }
  _hideMessage() { this._messageContainer.style.display = 'none'; this._liveRegion.textContent = ''; }
  _hideResults() { this._resultsContainer.style.display = 'none'; this._activeResultIndex = -1; }
}