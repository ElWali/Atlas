import { Layer } from '../layers/Layer.js';

export class Canvas extends Layer {
	onAdd() {
		this._container = document.createElement('canvas');
		this._ctx = this._container.getContext('2d');
		this._map.on('moveend', this._update, this);
		this._update();
	}

	onRemove() {
		this._map.off('moveend', this._update, this);
	}

	_update() {
		if (this._map._animatingZoom) { return; }
		this._container.width = this._map.getSize().x;
		this._container.height = this._map.getSize().y;
		this._ctx.clearRect(0, 0, this._container.width, this._container.height);
		const layers = this._map.getLayers();
		for (let i = 0; i < layers.length; i++) {
			if (layers[i].options.renderer === this) {
				layers[i]._update();
			}
		}
	}

	updatePoly(layer) {
		const points = layer._points;
		if (points.length === 0) { return; }
		this._ctx.beginPath();
		this._ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			this._ctx.lineTo(points[i].x, points[i].y);
		}
		this._setStyle(layer);
	}

	updatePolygon(layer) {
		const points = layer._points;
		if (points.length === 0) { return; }
		this._ctx.beginPath();
		this._ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			this._ctx.lineTo(points[i].x, points[i].y);
		}
		this._ctx.closePath();
		this._setStyle(layer, true);
	}

	updateCircle(layer) {
		const point = layer._point;
		const radius = layer._radius;
		if (point && radius) {
			this._ctx.beginPath();
			this._ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI, false);
			this._setStyle(layer, true);
		}
	}

	_setStyle(layer, filled) {
		const options = layer.options;
		if (options.stroke) {
			this._ctx.strokeStyle = options.color;
			this._ctx.lineWidth = options.weight;
			this._ctx.globalAlpha = options.opacity;
			if (options.dashArray) {
				this._ctx.setLineDash(options.dashArray);
			}
			if (options.dashOffset) {
				this._ctx.lineDashOffset = options.dashOffset;
			}
			this._ctx.stroke();
		}
		if (filled && options.fill) {
			this._ctx.fillStyle = options.fillColor || options.color;
			this._ctx.globalAlpha = options.fillOpacity;
			this._ctx.fill(options.fillRule || 'evenodd');
		}
	}

	bringToFront(layer) {
		// Not implemented for Canvas renderer
	}

	bringToBack(layer) {
		// Not implemented for Canvas renderer
	}
}