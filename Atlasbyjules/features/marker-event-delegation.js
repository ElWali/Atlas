/**
 * Enhanced marker event delegation
 */
const Atlas = window.Atlas || {};
Atlas.Feature = Atlas.Feature || {};

Atlas.Feature.MarkerEventDelegation = class {
  constructor(map) {
    this._map = map;
    this._markerContainer = null;
    this._delegationManager = null;
    this._markerMap = new WeakMap();
  }

  /**
   * Initialize marker event delegation
   */
  init() {
    // Create container for all markers
    const container = document.createElement('div');
    container.id = 'atlas-marker-container';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    this._map.container.appendChild(container);
    this._markerContainer = container;

    // Set up event delegation
    this._delegationManager = new EventDelegationManager(container);

    // Delegate marker events
    this._setupMarkerDelegation();
  }

  /**
   * Set up marker event delegation
   * @private
   */
  _setupMarkerDelegation() {
    this._delegationManager.on(
      'click',
      '.atlas-marker',
      (e) => {
        const marker = this._getMarkerForElement(e.target);
        if (marker) {
          marker.fire('click', { originalEvent: e });
        }
      }
    );

    this._delegationManager.on(
      'mouseenter',
      '.atlas-marker',
      (e) => {
        const marker = this._getMarkerForElement(e.target);
        if (marker && marker.options.riseOnHover) {
          marker._isHovered = true;
          marker._updateZIndex();
          marker._iconElement.classList.add('hover');
          marker.fire('mouseover', { originalEvent: e });
        }
      }
    );

    this._delegationManager.on(
      'mouseleave',
      '.atlas-marker',
      (e) => {
        const marker = this._getMarkerForElement(e.target);
        if (marker) {
          marker._isHovered = false;
          marker._updateZIndex();
          marker._iconElement.classList.remove('hover');
          marker.fire('mouseout', { originalEvent: e });
        }
      }
    );
  }

  /**
   * Register marker element
   */
  registerMarker(marker, element) {
    element.style.pointerEvents = 'auto';
    element.classList.add('atlas-marker-delegated');
    this._markerMap.set(element, marker);
  }

  /**
   * Get marker for element
   * @private
   */
  _getMarkerForElement(element) {
    let current = element;
    while (current) {
      if (current.classList.contains('atlas-marker-delegated')) {
        return this._markerMap.get(current);
      }
      current = current.parentNode;
    }
    return null;
  }

  /**
   * Destroy delegation
   */
  destroy() {
    if (this._delegationManager) {
      this._delegationManager.destroy();
    }
    if (this._markerContainer && this._markerContainer.parentNode) {
      this._markerContainer.parentNode.removeChild(this._markerContainer);
    }
    this._markerMap = new WeakMap();
  }
}
