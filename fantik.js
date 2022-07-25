"use strict"

let g_config = {};

function init() {
	const canvas = document.getElementById('canvas');

	const terrainEditor = new TerrainEditor(canvas, new Terrain());
	terrainEditor.terrain_redraw = draw;
	terrainEditor.terrain_commit = calc;

	window.addEventListener('resize', (evt) => {
		canvas.width = canvas.parentElement.clientWidth;
		canvas.height = canvas.parentElement.clientHeight;
		terrainEditor.on_resize();
	});

	g_config = readForm();

	window.dispatchEvent(new Event('resize'));

	document.querySelector('form').addEventListener('change', () => {
		g_config = readForm();
		window.dispatchEvent(new Event('resize'));
	});
}

function calc(terrain) {
	const diffP = g_config.maxVz / g_config.speed * g_config.step;
	const diffN = g_config.minVz / g_config.speed * g_config.step;
	const terrainValues = terrain.getValues(g_config.step).map(h => h + g_config.followH);

	const {path, breakPoints, stat} = getPathWithStat(terrainValues, diffP, diffN, g_config.tolerance);

	drawPath(path, breakPoints, terrain.getScope());
	document.getElementById('stat').innerHTML = stat;
}

function getPathWithStat(terrainValues, diffP, diffN, tolerance) {
	const path = terrainValues.map(_ => 0);

	for (let done = false; !done;) {
		const diff = path.map((e, i) => ([i, e - terrainValues[i]])).filter(e => e[1] < 0);
		
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

			path[index] = terrainValues[index];

			for (let i = index - 1; i >= 0; --i) {
				const diff = path[i + 1] - path[i];
				if (diff > diffP) {
					path[i] = path[i + 1] - diffP;
				} else if (diff < diffN) {
					path[i] = path[i + 1] - diffN;
				} else {
					break;
				}
			}

			for (let i = index + 1; i < path.length; ++i) {
				const diff = path[i] - path[i - 1];
				if (diff > diffP) {
					path[i] = path[i - 1] + diffP;
				} else if (diff < diffN) {
					path[i] = path[i - 1] + diffN;
				} else {
					break;
				}
			}
		}
	}

	const limits = terrainValues.map(v => [v, v + tolerance]);
	const optimized = optimizePath(path, limits, diffP, diffN);

	return {
		path: optimized.path,
		breakPoints: optimized.breakPoints,
		stat: path.filter((e, i) => e <= limits[i][1]).length / path.length * 100
	};
}

function optimizePath(path, limits, diffP, diffN) {
	path = optimizePathPass1(path, limits, diffP, diffN);
	path = optimizePathPass2(path, limits, diffP, diffN);
	return {path: path, breakPoints: getBreakPoints(path)};
}

function optimizePathPass1(path, limits, diffP, diffN) {
	path = [...path];

	let prevDiff = path[1] - path[0];

	for (let i = 2; i < path.length - 1; ++i) {
		const newValue = path[i - 1] + prevDiff;
		const isInLimit = (newValue >= path[i]) && (newValue <= limits[i][1]);

		let tail = i + 1;
		let diff = undefined;
		let isNextOk = false;

		for (; isInLimit && !isNextOk && tail < path.length; ++tail) {
			diff = (path[tail] - newValue) / (tail - i);
			isNextOk = (diff >= diffN) && (diff <= diffP);
		}

		if (isInLimit && isNextOk) {
			for (let j = i; j < tail; ++j) {
				path[j] = newValue + (j - i) * diff;
			}
		} else {
			prevDiff = path[i] - path[i - 1];
		}
	}

	return path;
}

function optimizePathPass2(path, limits, diffP, diffN) {
	let from = 0;

	while (from < path.length - 1) {
		let to = path.length - 1;

		for (let ok = false; !ok && to > from + 1; --to) {
			const diff = (path[to] - path[from]) / (to - from);

			if (diff >= diffN && diff <= diffP) {
				ok = true;
				const newPath = [...path];

				for (let i = from + 1; ok && i < to; ++i) {
					const newValue = newPath[from] + (i - from) * diff;
					newPath[i] = newValue;
					ok &= (newValue >= limits[i][0]) && (newValue <= limits[i][1]);
				}

				if (ok) {
					path = newPath;
				}
			}
		}

		from = to;
	}

	return path;
}

function getBreakPoints(path) {
	return path.map((e, i) =>
		(i == 0) || (i == path.length - 1) || (Math.abs(2 * e - path[i - 1] - path[i + 1]) > 1e-6));
}

function readForm() {
	return {
		speed: +document.getElementById('speed').value,
		maxVz: +document.getElementById('maxVz').value,
		minVz: +document.getElementById('minVz').value,
		followH: +document.getElementById('followH').value,
		tolerance: +document.getElementById('tolerance').value,
		step: +document.getElementById('step').value,
	};
}

class TerrainEditor {
	constructor(canvas, terrain) {
		this._canvas = canvas;
		this._terrain = terrain;
		this._lastCoord = undefined;

		canvas.addEventListener('mousedown', (evt) => this.onMouseDown(evt));
		canvas.addEventListener('mouseup', (evt) => this.onMouseUp(evt));
	}

	on_resize() {
		if (this._terrain_redraw) {
			this._terrain_redraw(this._terrain);
		}

		if (this._terrain_commit) {
			this._terrain_commit(this._terrain);
		}
	}

	set terrain_redraw(func) {
		this._terrain_redraw = func;
	}

	set terrain_commit(func) {
		this._terrain_commit = func;
	}

	onMouseDown(evt) {
		if (evt.button == 0) {
			if (this._event_function) {
				this._canvas.removeEventListener('mousemove', this._event_function);
			}

			this._event_function = (evt) => this.onMouseMove(evt);
			this._canvas.addEventListener('mousemove', this._event_function);
			this.onMouseMove(evt);
		}
	}

	onMouseUp(evt) {
		if (evt.button == 0) {
			this._canvas.removeEventListener('mousemove', this._event_function);
			this._event_function = null;
			this._lastCoord = undefined;

			if (this._terrain_commit) {
				this._terrain_commit(this._terrain);
			}
		}
	}

	onMouseMove(evt) {
		const scaleX = this._canvas.width / this._terrain.getScope().length;
		const scaleY = this._canvas.height / this._terrain.getScope().height;
		const index = Math.floor(evt.offsetX / scaleX);
		const h = (this._canvas.height - evt.offsetY) / scaleY;
		this._terrain.setValue(index, h);

		if (this._lastCoord) {
			const fromIndex = Math.min(this._lastCoord[0], index);
			const toIndex = Math.max(this._lastCoord[0], index);
			const fromH = this._terrain.getValues()[fromIndex];
			const toH = this._terrain.getValues()[toIndex];
			for (let i = fromIndex + 1; i < toIndex; ++i) {
				this._terrain.setValue(i, fromH + (toH - fromH) / (toIndex - fromIndex) * (i - fromIndex));
			}
		}

		this._lastCoord = [index, h];

		if (this._terrain_redraw) {
			this._terrain_redraw(this._terrain);
		}
	}
}

class Terrain {
	constructor(width = 10000, height = 500, grid = 10) {
		this._height = height;
		this._width = width;
		this._grid = grid;
		this._values = new Array(width / grid).fill(0);
	}

	getScope() {
		return {length: this._values.length, width: this._width, height: this._height};
	}

	getValues(grid) {
		if (grid == undefined || grid <= this._grid) {
			return this._values;
		}

		const indexStep = grid / this._grid;

		const res = [];

		for (let index = 0.0; index < this._values.length; index += indexStep) {
			res.push(this._values[Math.floor(index)]);
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

	const scaleX = canvas.width / terrain.getScope().length;
	const scaleY = canvas.height / terrain.getScope().height;

	terrain.getValues().map((h, i) =>
		([Math.floor(i * scaleX), canvas.height - h * scaleY, Math.floor(scaleX) + 1, h * scaleY]))
	.forEach(e => {
		ctx.fillStyle = '#000000';
		ctx.fillRect(...e);
		ctx.fillStyle = '#AAFFAA';
		ctx.fillRect(e[0], e[1] - (g_config.followH + g_config.tolerance) * scaleY, e[2], g_config.tolerance * scaleY);
	});

	ctx.restore();
}

function drawPath(path, breakPoints, scope) {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	ctx.strokeStyle = '#FF00FF';
	ctx.fillStyle = '#FF00FF';

	const scaleX = scope.width / canvas.width;
	const scaleY = scope.height / canvas.height;
	const circleRadius = 2;

	let prev = undefined;

	path.forEach((e, i) => {
		if (breakPoints[i]) {
			const x = i * g_config.step / scaleX;
			const y = canvas.height - e / scaleY;

			if (prev) {
				ctx.beginPath();
				ctx.moveTo(...prev);
				ctx.lineTo(x, y);
				ctx.stroke();
			}

			ctx.beginPath();
			ctx.arc(x, y, circleRadius, 0, 2 * Math.PI, false);
			ctx.fill();

			prev = [x, y];
		}
	});
}
