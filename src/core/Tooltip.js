import { Layer } from '../layers/Layer.js';
import { toPoint } from './Point.js';

export class Tooltip extends Layer {
	constructor(options, source) {
		super(options);
		this._source = source;
		this.options.pane = 'tooltipPane';
	}

	onAdd(map) {
		this._map = map;
		this._container = this._map.getPane(this.options.pane);
		this._update();
		this._container.appendChild(this._container);
		this._source.on('mousemove', this._onMouseMove, this);
	}

	onRemove() {
		this._container.removeChild(this._container);
		this._source.off('mousemove', this._onMouseMove, this);
	}

	_onMouseMove(e) {
		this._latlng = e.latlng;
		this._updatePosition();
	}

	_update() {
		if (!this._container) { return; }
		this._container.innerHTML = this.options.content || '';
	}

	_updatePosition() {
		if (this._latlng) {
			const pos = this._map.latLngToLayerPoint(this._latlng);
			this._setPosition(pos);
		}
	}

	_setPosition(pos) {
		const container = this._container;
		pos = toPoint(pos);
		container.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
	}
}