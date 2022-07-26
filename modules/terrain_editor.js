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

export {TerrainEditor};
