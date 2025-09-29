import { Control } from './Control.js';

export class LayerControl extends Control {
	constructor(baseLayers, overlays, options) {
		super(options);
		this._layers = [];
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (const i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (const i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	}

	onAdd(map) {
		this._initLayout();
		this._update();
		this._map
		    .on('layeradd', this._onLayerChange, this)
		    .on('layerremove', this._onLayerChange, this);
		return this._container;
	}

	onRemove() {
		this._map
		    .off('layeradd', this._onLayerChange, this)
		    .off('layerremove', this._onLayerChange, this);
	}

	addBaseLayer(layer, name) {
		this._addLayer(layer, name);
		return (this._map) ? this._update() : this;
	}

	addOverlay(layer, name) {
		this._addLayer(layer, name, true);
		return (this._map) ? this._update() : this;
	}

	removeLayer(layer) {
		layer.off('add remove', this._onLayerChange, this);
		const obj = this._getLayer(layer.getLayerId());
		if (obj) {
			this._layers.splice(this._layers.indexOf(obj), 1);
		}
		return (this._map) ? this._update() : this;
	}

	expand() {
		this._container.classList.add('atlas-control-layers-expanded');
		this._section.style.height = null;
		const acceptableHeight = this._map.getSize().y - (this._container.y + 50);
		if (acceptableHeight < this._section.clientHeight) {
			this._section.classList.add('atlas-control-layers-scrollbar');
			this._section.style.height = `${acceptableHeight}px`;
		} else {
			this._section.classList.remove('atlas-control-layers-scrollbar');
		}
		return this;
	}

	collapse() {
		this._container.classList.remove('atlas-control-layers-expanded');
		return this;
	}

	_initLayout() {
		const className = 'atlas-control-layers',
		      container = this._container = document.createElement('div');
		container.className = className;
		container.setAttribute('aria-haspopup', true);

		this._section = document.createElement('section');
		this._section.className = 'atlas-control-layers-list';

		this._layersLink = document.createElement('a');
		this._layersLink.className = 'atlas-control-layers-toggle';
		this._layersLink.href = '#';
		this._layersLink.title = 'Layers';
		this._layersLink.role = 'button';

		this._layersLink.addEventListener('focus', this.expand.bind(this));
		this._container.addEventListener('blur', this.collapse.bind(this));

		this._map.on('click', this.collapse, this);

		const form = this._form = document.createElement('form');
		form.className = 'atlas-control-layers-form';

		this._baseLayersList = document.createElement('div');
		this._baseLayersList.className = 'atlas-control-layers-base';
		this._separator = document.createElement('div');
		this._separator.className = 'atlas-control-layers-separator';
		this._overlaysList = document.createElement('div');
		this._overlaysList.className = 'atlas-control-layers-overlays';

		container.appendChild(this._layersLink);
		form.appendChild(this._baseLayersList);
		form.appendChild(this._separator);
		form.appendChild(this._overlaysList);
		container.appendChild(form);
	}

	_getLayer(id) {
		for (let i = 0; i < this._layers.length; i++) {
			if (this._layers[i] && this._layers[i].layer.getLayerId() === id) {
				return this._layers[i];
			}
		}
	}

	_addLayer(layer, name, overlay) {
		layer.on('add remove', this._onLayerChange, this);
		this._layers.push({
			layer: layer,
			name: name,
			overlay: overlay
		});
	}

	_update() {
		if (!this._container) { return this; }
		this._baseLayersList.innerHTML = '';
		this._overlaysList.innerHTML = '';
		let baseLayersPresent = false,
		    overlaysPresent = false,
		    i, obj;

		for (i = 0; i < this._layers.length; i++) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
		}
		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
		return this;
	}

	_onLayerChange(e) {
		if (!this._handlingClick) {
			this._update();
		}
		const obj = this._getLayer(e.target.getLayerId());
		const type = obj.overlay ?
			(e.type === 'add' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'add' ? 'baselayerchange' : null);
		if (type) {
			this._map.fire(type, obj);
		}
	}

	_addItem(obj) {
		const label = document.createElement('label'),
		      checked = this._map.hasLayer(obj.layer);
		let input;
		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'atlas-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('atlas-base-layers', checked);
		}
		input.layerId = obj.layer.getLayerId();
		input.addEventListener('click', this._onInputClick, this);
		const name = document.createElement('span');
		name.innerHTML = ` ${obj.name}`;
		const holder = document.createElement('div');
		label.appendChild(holder);
		holder.appendChild(input);
		holder.appendChild(name);
		const container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);
		return label;
	}

	_onInputClick() {
		const inputs = this._form.getElementsByTagName('input'),
		      input, layer;
		let addedLayers = [],
		    removedLayers = [];
		this._handlingClick = true;
		for (let i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			if (input.layerId) {
				layer = this._getLayer(input.layerId).layer;
				if (input.checked) {
					addedLayers.push(layer);
				} else if (!input.checked) {
					removedLayers.push(layer);
				}
			}
		}
		for (let i = 0; i < removedLayers.length; i++) {
			if (this._map.hasLayer(removedLayers[i])) {
				this._map.removeLayer(removedLayers[i]);
			}
		}
		for (let i = 0; i < addedLayers.length; i++) {
			if (!this._map.hasLayer(addedLayers[i])) {
				this._map.addLayer(addedLayers[i]);
			}
		}
		this._handlingClick = false;
		this._refocusOnMap();
	}

	_createRadioElement(name, checked) {
		const radioHtml = `<input type="radio" class="atlas-control-layers-selector" name="${name}"${checked ? ' checked' : ''}/>`;
		const temp = document.createElement('div');
		temp.innerHTML = radioHtml;
		return temp.firstChild;
	}
}