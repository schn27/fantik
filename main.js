import {Terrain} from './modules/terrain.js';
import {TerrainEditor} from './modules/terrain_editor.js';
import {getPathWithStat} from './modules/fantik.js';

const COLOR_TERRAIN = '#000000';
const COLOR_TERRAIN_GRID = '#222222';
const COLOR_LOW = '#FFFF66';
const COLOR_TOLERANCE = '#66FF66';
const COLOR_PATH = '#FF00FF';
const COLOR_NOT_OPTIMIZED_PATH = '#AAAAAA';

let g_config = {};
init();

function init() {
	const canvas = document.getElementById('canvas');

	const terrainEditor = new TerrainEditor(canvas, new Terrain());
	terrainEditor.terrain_redraw = draw;
	terrainEditor.terrain_commit = calc;

	document.getElementById('randomTerrain').onclick = () => {
		terrainEditor.generate();
	}

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
	const terrainValues = terrain.getValues(g_config.step);

	drawSteps(terrain);

	/* Здесь только первая и последняя точки помечены как контрольные.
	 * В реальном использовании любое количество точек может быть помечено как контрольные.
	 * Это необходимо, если на обработку отдан маршрут с поворотными пунктами, которые должны остаться
	 * в результирующем массиве контрольных точек.
	 */
	const controlPoints = terrainValues.map((_, i) => (i == 0) || (i == terrainValues.length - 1));

	const result = getPathWithStat(terrainValues, controlPoints, g_config);

	drawPath(result.not_optimized_path, result.not_optimized_path.map(_ => true), terrain.getScope(), COLOR_NOT_OPTIMIZED_PATH);
	drawPath(result.path, result.controlPoints, terrain.getScope());

	document.getElementById('stat').innerHTML = Math.round(result.stat);
	document.getElementById('averageHeight').innerHTML = Math.round(result.averageHeight);
	document.getElementById('minHeight').innerHTML = Math.round(result.minHeight);
	document.getElementById('maxHeight').innerHTML = Math.round(result.maxHeight);

	const ok = validate(result.path, result.controlPoints, terrainValues, g_config);
	document.getElementById('valid').innerHTML = ok ? 'Норм' : 'Ошибка';
	document.getElementById('valid').style = ok ? 'background-color:green;' : 'background-color:red;';
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

	terrain.getValues()
		.map((h, i) =>
			([Math.floor(i * scaleX), canvas.height - h * scaleY, Math.floor(scaleX) + 1, h * scaleY]))
		.forEach(e => {
			ctx.fillStyle = COLOR_TERRAIN;
			ctx.fillRect(...e);
			ctx.fillStyle = COLOR_LOW;
			ctx.fillRect(e[0], e[1] - g_config.followH * scaleY, e[2], g_config.followH * scaleY);
			ctx.fillStyle = COLOR_TOLERANCE;
			ctx.fillRect(e[0], e[1] - (g_config.followH + g_config.tolerance) * scaleY, e[2], g_config.tolerance * scaleY);
		});

	ctx.restore();
}

function drawSteps(terrain) {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');

	ctx.save();

	const values = terrain.getValues(g_config.step);

	const scaleX = canvas.width / values.length;
	const scaleY = canvas.height / terrain.getScope().height;

	ctx.beginPath();
	ctx.strokeStyle = COLOR_TERRAIN_GRID;
	ctx.lineWidth = 1;

	values.map((h, i) =>
			([Math.floor(i * scaleX), canvas.height, Math.floor(i * scaleX), canvas.height - h * scaleY]))
		.forEach(e => {
			ctx.moveTo(e[0], e[1]);
			ctx.lineTo(e[2], e[3]);
		});

	ctx.stroke();

	ctx.restore();
}

function drawPath(path, breakPoints, scope, color = COLOR_PATH) {
	const canvas = document.getElementById('canvas');
	const ctx = canvas.getContext('2d');
	ctx.strokeStyle = color;
	ctx.fillStyle = color;

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

function validate(path, controlPoints, terrainValues, config) {
	let prevH = undefined;
	let dist = 0;
	const vzs = [];

	for (let i = 0; i < path.length; ++i) {
		dist += config.step;

		if (controlPoints[i]) {
			if (prevH != undefined) {
				vzs.push((path[i] - prevH) / dist * config.speed);
			}

			prevH = path[i];
			dist = 0;
		}
	}

	const TOLERANCE = 1e-6;

	const h_ok = path.every((e, i) => e >= terrainValues[i] + config.followH);
	const vz_ok = vzs.every(e => e <= config.maxVz + TOLERANCE && e >= config.minVz - TOLERANCE);

	return h_ok && vz_ok;
}