export class Evented {
	constructor() {
		this._events = {};
	}

	on(types, fn, context) {
		if (typeof types === 'object') {
			for (const type in types) {
				this._on(type, types[type], fn);
			}
		} else {
			types = types.split(' ');
			for (let i = 0, len = types.length; i < len; i++) {
				this._on(types[i], fn, context);
			}
		}
		return this;
	}

	off(types, fn, context) {
		if (!types) {
			delete this._events;
		} else if (typeof types === 'object') {
			for (const type in types) {
				this._off(type, types[type], fn);
			}
		} else {
			types = types.split(' ');
			for (let i = 0, len = types.length; i < len; i++) {
				this._off(types[i], fn, context);
			}
		}
		return this;
	}

	_on(type, fn, context) {
		this._events = this._events || {};
		let typeListeners = this._events[type];
		if (!typeListeners) {
			typeListeners = [];
			this._events[type] = typeListeners;
		}
		if (context === this) {
			context = undefined;
		}
		const newListener = {fn: fn, ctx: context};
		for (let i = 0, len = typeListeners.length; i < len; i++) {
			if (typeListeners[i].fn === fn && typeListeners[i].ctx === context) {
				return;
			}
		}
		typeListeners.push(newListener);
	}

	_off(type, fn, context) {
		let listeners,
		    i,
		    len;
		if (!this._events) { return; }
		listeners = this._events[type];
		if (!listeners) { return; }
		if (!fn) {
			this.fire(type, {type: `${type}:removed`});
			delete this._events[type];
			return;
		}
		if (context === this) {
			context = undefined;
		}
		if (listeners) {
			for (i = 0, len = listeners.length; i < len; i++) {
				const l = listeners[i];
				if (l.ctx !== context) { continue; }
				if (l.fn === fn) {
					l.fn = function () {};
					this._firingCount = this._firingCount + 1;
					this.fire(type, {
						type: `${type}:removed`,
						listener: l.fn
					});
					this._firingCount = this._firingCount - 1;
					return;
				}
			}
		}
	}

	fire(type, data, propagate) {
		if (!this.listens(type, propagate)) { return this; }
		const event = {
			type: type,
			target: this,
			sourceTarget: data && data.sourceTarget || this
		};
		if (data) {
			for (const i in data) {
				event[i] = data[i];
			}
		}
		if (this._events) {
			const listeners = this._events[type];
			if (listeners) {
				this._firingCount = (this._firingCount || 0) + 1;
				for (let i = 0, len = listeners.length; i < len; i++) {
					const l = listeners[i];
					l.fn.call(l.ctx || this, event);
				}
				this._firingCount--;
			}
		}
		if (propagate) {
			this._propagateEvent(event);
		}
		return this;
	}

	listens(type, propagate) {
		const listeners = this._events && this._events[type];
		if (listeners && listeners.length > 0) { return true; }
		if (propagate) {
			for (const id in this._eventParents) {
				if (this._eventParents[id].listens(type, propagate)) { return true; }
			}
		}
		return false;
	}

	once(types, fn, context) {
		if (typeof types === 'object') {
			for (const type in types) {
				this.once(type, types[type], fn);
			}
			return this;
		}
		const once = (...args) => {
			this
			    .off(types, fn, context)
			    .off(types, once, context);
			return fn.apply(context || this, args);
		};
		once.fn = fn;
		return this
		    .on(types, once, context);
	}

	addEventParent(obj) {
		this._eventParents = this._eventParents || {};
		this._eventParents[obj._leaflet_id] = obj;
		return this;
	}

	removeEventParent(obj) {
		if (this._eventParents) {
			delete this._eventParents[obj._leaflet_id];
		}
		return this;
	}

	_propagateEvent(e) {
		for (const id in this._eventParents) {
			this._eventParents[id].fire(e.type, e, true);
		}
	}
}