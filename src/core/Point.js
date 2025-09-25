export function toPoint(x, y, round) {
	if (x instanceof Point) {
		return x;
	}
	if (Array.isArray(x)) {
		return new Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	if (typeof x === 'object' && 'x' in x && 'y' in x) {
		return new Point(x.x, x.y);
	}
	return new Point(x, y, round);
}

export class Point {
	constructor(x, y, round) {
		this.x = (round ? Math.round(x) : x);
		this.y = (round ? Math.round(y) : y);
	}

	clone() {
		return new Point(this.x, this.y);
	}

	add(other) {
		return this.clone()._add(toPoint(other));
	}

	_add(other) {
		this.x += other.x;
		this.y += other.y;
		return this;
	}

	subtract(other) {
		return this.clone()._subtract(toPoint(other));
	}

	_subtract(other) {
		this.x -= other.x;
		this.y -= other.y;
		return this;
	}

	divideBy(num) {
		return this.clone()._divideBy(num);
	}

	_divideBy(num) {
		this.x /= num;
		this.y /= num;
		return this;
	}

	multiplyBy(num) {
		return this.clone()._multiplyBy(num);
	}

	_multiplyBy(num) {
		this.x *= num;
		this.y *= num;
		return this;
	}

	scaleBy(scale) {
		return new Point(this.x * scale.x, this.y * scale.y);
	}

	unscaleBy(scale) {
		return new Point(this.x / scale.x, this.y / scale.y);
	}

	round() {
		return this.clone()._round();
	}

	_round() {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}

	floor() {
		return this.clone()._floor();
	}

	_floor() {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	}

	ceil() {
		return this.clone()._ceil();
	}

	_ceil() {
		this.x = Math.ceil(this.x);
		this.y = Math.ceil(this.y);
		return this;
	}

	distanceTo(other) {
		other = toPoint(other);
		const x = other.x - this.x;
		const y = other.y - this.y;
		return Math.sqrt(x * x + y * y);
	}

	equals(other) {
		other = toPoint(other);
		return other.x === this.x &&
		       other.y === this.y;
	}

	contains(other) {
		other = toPoint(other);
		return Math.abs(other.x) <= Math.abs(this.x) &&
		       Math.abs(other.y) <= Math.abs(this.y);
	}

	toString() {
		return `Point(${this.x}, ${this.y})`;
	}
}