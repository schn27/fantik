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

	generate() {
		const n = this._terrain.getValues().length;
		const max_freq =  (2 * Math.PI / n) * 50;
		const min_freq = 0.01;
		const num_of_freqs = 100;
		const amplitude = this._terrain.getScope().height * 0.2;

		const freqs = [];

		for (let i = 0; i < num_of_freqs; ++i) {
			const freq = Math.pow(Math.random(), 5);
			freqs.push({
				'freq': Math.max(min_freq, freq * max_freq),
				'phase': Math.random() * 2 * Math.PI,
				'amplitude': Math.random() * (1 - Math.pow(freq, 0.03))});
		}

		for (let i = 0; i < n; ++i) {
			const v = freqs.map(e => e.amplitude * Math.sin(e.freq * i + e.phase)).reduce((a, e) => a + e, 0);
			this._terrain.setValue(i, Math.max(amplitude * (v + 1.0), 0));
		}

		this.on_resize();
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
		const index = Math.min(Math.floor(evt.offsetX / scaleX), this._terrain.getValues().length - 1);
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

export {TerrainEditor};
