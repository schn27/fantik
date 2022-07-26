import {Terrain} from './modules/terrain.js';
import {TerrainEditor} from './modules/terrain_editor.js';
import {getPathWithStat} from './modules/fantik.js';

let g_config = {};
init();

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
