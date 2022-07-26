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

export {getPathWithStat};
