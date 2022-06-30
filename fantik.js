"use strict"

class Terrain {
	constructor() {
		this._maxValue = 500;
		this._length = 1000;
		this._grid = 10;
		this._values = new Array(this._length);
		this._values.fill(0);
	}

	getMaxValue() {
		return this._maxValue;
	}

	getDistance() {
		return this._length * this._grid;
	}

	getLength() {
		return this._length;
	}

	getGrid() {
		return this._grid;
	}

	getValues(step) {
		if (step == undefined || step <= this._grid) {
			return this._values;
		}

		const indexStep = step / this._grid;

		const res = [];

		for (let index = 0; index < this._values.length; index += indexStep) {
			res.push(Math.max(...this._values.slice(Math.floor(index), Math.floor(index + indexStep))));
		}

		return res;
	}

	setValue(index, value) {
		if (index >= 0 && index < this._values.length) {
			this._values[index] = value;
		}
	}
}

function draw(terrain) {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');

	ctx.save();
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = '#000000';

	const scaleX = canvas.width / terrain.getLength();
	const scaleY = canvas.height / terrain.getMaxValue();

	terrain.getValues().map((h, i) => 
		([Math.floor(i * scaleX), canvas.height - h * scaleY, Math.floor(scaleX) + 1, h * scaleY]))
	.forEach(e => ctx.fillRect(...e));

	ctx.restore();
}

let terrain = new Terrain();
let lastCoord = undefined;

function fantik() {
	const canvas = document.getElementById('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	canvas.addEventListener('mousedown', onMouseDown);
	canvas.addEventListener('mouseup', onMouseUp);

	draw(terrain);
}

function onMouseDown(evt) {
	if (evt.buttons == 1) {
		document.getElementById('canvas').addEventListener('mousemove', onMouseMove);
		onMouseMove(evt);
	}
}

function onMouseUp(evt) {
	if (evt.buttons == 0) {
		document.getElementById('canvas').removeEventListener('mousemove', onMouseMove);
		lastCoord = undefined;

		drawPath(getPath(terrain));
	}
}

function onMouseMove(evt) {
	if (evt.buttons == 0) {
		onMouseUp(evt);
		return;
	}

	const canvas = document.getElementById('canvas');
	const scaleX = canvas.width / terrain.getLength();
	const scaleY = canvas.height / terrain.getMaxValue();
	const index = Math.floor(evt.clientX / scaleX);
	const h = (canvas.height - evt.clientY) / scaleY;
	terrain.setValue(index, h);

	if (lastCoord) {
		const fromIndex = Math.min(lastCoord[0], index);
		const toIndex = Math.max(lastCoord[0], index);
		const fromH = terrain.getValues()[fromIndex];
		const toH = terrain.getValues()[toIndex];
		for (let i = fromIndex + 1; i < toIndex; ++i) {
			terrain.setValue(i, fromH + (toH - fromH) / (toIndex - fromIndex) * (i - fromIndex));
		}
	}

	lastCoord = [index, h];

	draw(terrain);
}

function drawPath(path) {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');

	ctx.strokeStyle = '#FF00FF';
	ctx.fillStyle = '#FF00FF';

	const scaleX = terrain.getDistance() / canvas.width;
	const scaleY = terrain.getMaxValue() / canvas.height;

	let prev = undefined;

	const getX = (x) => x / scaleX;
	const getY = (y) => canvas.height  - y / scaleY;
	const circleRadius = 2;

	path.forEach(e => {
		if (prev) {
			ctx.beginPath();
			ctx.moveTo(getX(prev[0]), getY(prev[1]));
			ctx.lineTo(getX(e[0]), getY(e[1]));
			ctx.stroke();
		}

		ctx.beginPath();
		ctx.arc(getX(e[0]), getY(e[1]), circleRadius, 0, 2 * Math.PI, false);
		ctx.fill();
		prev = e;
	});
}

function getPath(terrain) {
	const step = 100;
	const maxVz = 2.0;
	const minVz = -3.0;
	const speed = 26.0;
	const followH = 70.0;

	const maxGradient = maxVz / speed * step;
	const minGradient = minVz / speed * step;

	const terrainValues = terrain.getValues(step);
	const pathValues = terrainValues.map(_ => 0);

	for (let done = false; !done;) {
		const diff = pathValues.map((e, i) => ([i, e - terrainValues[i]])).filter(e => e[1] < 0);
		
		if (diff.length == 0) {
			done = true;

		} else {
			let min = diff[0];

			for (let i = 1; i < diff.length; ++i) {
				if (diff[i][1] < min[1]) {
					min = diff[i];
				}
			}

			const index = min[0];

			pathValues[index] = terrainValues[index];

			for (let i = index - 1; i >= 0; --i) {
				const delta = pathValues[i + 1] - pathValues[i];
				if (delta > maxGradient) {
					pathValues[i] = pathValues[i + 1] - maxGradient;
				} else if (delta < minGradient) {
					pathValues[i] = pathValues[i + 1] - minGradient;
				} else {
					break;
				}
			}

			for (let i = index + 1; i < pathValues.length; ++i) {
				const delta = pathValues[i] - pathValues[i - 1];
				if (delta > maxGradient) {
					pathValues[i] = pathValues[i - 1] + maxGradient;
				} else if (delta < minGradient) {
					pathValues[i] = pathValues[i - 1] + minGradient;
				} else {
					break;
				}
			}
		}
	}

	return optimizePath(pathValues.map((h, i) => ([i * step, h + followH])), 0.005);
}

function optimizePath(path, maxError) {
	let error = 0;

	let prevGradient = undefined;
	let prev = undefined;

	const res = [];

	path.forEach(e => {
		if (res.length == 0) {
			res.push(e);
		} else {
			const last = res[res.length - 1];
			const gradient = (e[1] - last[1]) / (e[0] - last[0]);

			if (prevGradient == undefined) {
				prevGradient = gradient;
			}

			if (prev && Math.abs(gradient - prevGradient) > maxError) {
				res.push(prev);
				prevGradient = (e[1] - prev[1]) / (e[0] - prev[0]);
			}


			prev = e;
		}
	});

	res.push(prev);

	return res;
}
