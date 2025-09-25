import { Layer } from '../Layer.js';

export class Path extends Layer {
	constructor(options) {
		super(options);
		this.options = {
			stroke: true,
			color: '#3388ff',
			weight: 3,
			opacity: 1,
			lineCap: 'round',
			lineJoin: 'round',
			dashArray: null,
			dashOffset: null,
			fill: false,
			fillColor: null,
			fillOpacity: 0.2,
			fillRule: 'evenodd',
			bubblingMouseEvents: true,
			...options
		};
	}

	bringToFront() {
		if (this._map) {
			this._map._renderer.bringToFront(this);
		}
		return this;
	}

	bringToBack() {
		if (this._map) {
			this._map._renderer.bringToBack(this);
		}
		return this;
	}

	setStyle(style) {
		Object.assign(this.options, style);
		if (this._map) {
			this._map._renderer.setStyle(this);
		}
		return this;
	}
}