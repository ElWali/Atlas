import {Layer} from './Layer.js';

export class LayerGroup extends Layer {
	constructor(layers, options) {
		super(options);
		this._layers = {};
		let i, len;
		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	}

	addLayer(layer) {
		const id = this.getLayerId(layer);
		this._layers[id] = layer;
		if (this._map) {
			this._map.addLayer(layer);
		}
		return this;
	}

	removeLayer(layer) {
		const id = layer in this._layers ? layer : this.getLayerId(layer);
		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}
		delete this._layers[id];
		return this;
	}

	hasLayer(layer) {
		return !!layer && (this.getLayerId(layer) in this._layers || layer in this._layers);
	}

	clearLayers() {
		for (const i in this._layers) {
			this.removeLayer(this._layers[i]);
		}
		return this;
	}

	invoke(methodName) {
		const args = Array.prototype.slice.call(arguments, 1);
		for (const i in this._layers) {
			this._layers[i][methodName].apply(this._layers[i], args);
		}
		return this;
	}

	onAdd(map) {
		this._map = map;
		this.eachLayer(map.addLayer, map);
	}

	onRemove(map) {
		this.eachLayer(map.removeLayer, map);
		this._map = null;
	}

	eachLayer(method, context) {
		for (const i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	}

	getLayer(id) {
		return this._layers[id];
	}

	getLayers() {
		const layers = [];
		for (const i in this._layers) {
			layers.push(this._layers[i]);
		}
		return layers;
	}

	setZIndex(zIndex) {
		return this.invoke('setZIndex', zIndex);
	}

	getLayerId(layer) {
		return layer._atlas_id || (layer._atlas_id = ++LayerGroup.lastId);
	}
}

LayerGroup.lastId = 0;