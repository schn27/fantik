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
		if (grid == undefined) {
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

export {Terrain};
