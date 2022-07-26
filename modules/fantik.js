/* Построение маршрута огибания рельефа.
 *
 * terrainValues - массив высот рельефа взятых вдоль маршрута с шагом config.step метров
 * controlPoints - массив (true/false) контрольных точек (ППМ) исходного маршрута,
 *                 должен по размеру совпадать с terrainValues
 * config - объект с параметрами огибания:
 *   step - шаг точек в массиве terrainValues, м
 *   followH - высота огибания, м
 *   tolerance - допустимое отклонение вверх от высоты огибания, м
 *   speed - максимальная путевая скорость (истинная воздушная + прогнозируемый ветер), м/с
 *   maxVz - максимальная вертикальная скорость (набор), м/с
 *   minVz - минимальная ветикальная скорость (снижение, должна быть отрицательная), м/с
 *
 * Возвращает объект:
 *   path - массив абсолютных высот точек в метрах (размер совпадает с terrainValues)
 *   controlPoints - массив (true/false) контрольных точек (исходные ППМ + точки именения градиента, расчитанные алгоритмом)
 *   insideLimits - массив (true/false) признаков, находится ли точка внутри зоны допуска по высоте
 *   stat - процент точек, которые находятся внутри зоны допуска по высоте
 *   averageHeight - среднее превышение над рельефом, м
 *   minHeight - минимальное превышение над рельефом (должно совпадать с config.followH), м
 *   maxHeight - максимальное превышение над рельефом, м
 *
 * Для использования необходимо:
 * 1) Вдоль маршрута расставить точки с шагом config.step
 * 2) Полученные точки объединить с исходными ППМ в один массив
 * 3) Сформировать на основе него массив высот рельефа (terrainValues)
 * 3) Cформировать массив controlPoints, в котором как true отметить исходные ППМ, а остальные оставить false
 * 4) Вызвать getPathWithStat
 * 5) Использовать массив из п. 2 и полученные path и controlPoints для формирования результирующего ПЗ
 *    (точки, помеченные как false в conrolPoits не идут в ПЗ)
 * 6) Использовать insideLimits, stat, averageHeight и maxHeight для информирования.
 *    Предполагается, что  может быть использован для пометки на карте мест, где происходит
 *    выход за допустимый допуск по высоте (config.tolerance)
 */

function getPathWithStat(terrainValues, controlPoints, config) {
	const diffP = config.maxVz / config.speed * config.step;
	const diffN = config.minVz / config.speed * config.step;

	const limits = terrainValues.map(v => [v + config.followH, v + config.followH + config.tolerance]);

	const path = terrainValues.map(_ => -1e6);

	for (let done = false; !done;) {
		const diff = path.map((e, i) => ([i, e - limits[i][0]])).filter(e => e[1] < 0);
		
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

			path[index] = limits[index][0];

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

	const optimized = optimizePath(path, controlPoints, limits, diffP, diffN);

	const insideLimits = optimized.path.map((e, i) => (e >= limits[i][0]) && (e <= limits[i][1]));
	const stat = insideLimits.filter(e => e).length / insideLimits.length * 100;
	const heights = optimized.path.map((e, i) => e - terrainValues[i]);
	const averageHeight = heights.reduce((a, e) => a + e, 0) / heights.length;
	const minHeight = Math.min(...heights);
	const maxHeight = Math.max(...heights);

	return {...optimized, insideLimits, stat, averageHeight, minHeight, maxHeight};
}

function optimizePath(path, controlPoints, limits, diffP, diffN) {
	path = optimizePathPass1(path, limits, diffP, diffN);
	path = optimizePathPass2(path, limits, diffP, diffN);
	controlPoints = getControlPoints(path).map((e, i) => e || controlPoints[i]);
	return {path, controlPoints};
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

function getControlPoints(path) {
	return path.map((e, i) => (i == 0) || (i == path.length - 1) ||
		(Math.abs(2 * e - path[i - 1] - path[i + 1]) > 1e-3));
}

export {getPathWithStat};
