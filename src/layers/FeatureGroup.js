import {LayerGroup} from './LayerGroup.js';

export class FeatureGroup extends LayerGroup {
	addLayer(layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		layer.addEventParent(this);
		super.addLayer(layer);
		return this.fire('layeradd', {layer: layer});
	}

	removeLayer(layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		layer.removeEventParent(this);
		super.removeLayer(layer);
		return this.fire('layerremove', {layer: layer});
	}

	setStyle(style) {
		return this.invoke('setStyle', style);
	}

	bringToFront() {
		return this.invoke('bringToFront');
	}

	bringToBack() {
		return this.invoke('bringToBack');
	}

	getBounds() {
		const bounds = toLatLngBounds();
		this.eachLayer(function (layer) {
			bounds.extend(layer.getBounds ? layer.getBounds() : layer.getLatLng());
		});
		return bounds;
	}
}