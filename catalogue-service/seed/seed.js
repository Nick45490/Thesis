const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "data.json");

function loadSeedData() {
	const raw = fs.readFileSync(dataPath, "utf-8");
	const data = JSON.parse(raw);

	const manufacturerCount = Array.isArray(data.manufacturers) ? data.manufacturers.length : 0;
	const modelCount = Array.isArray(data.models) ? data.models.length : 0;
	const generationCount = Array.isArray(data.generations) ? data.generations.length : 0;

	return {
		data,
		summary: {
			manufacturerCount,
			modelCount,
			generationCount
		}
	};
}

if (require.main === module) {
	const { summary } = loadSeedData();
	console.log("Catalogue seed data loaded", summary);
}

module.exports = {
	loadSeedData
};
