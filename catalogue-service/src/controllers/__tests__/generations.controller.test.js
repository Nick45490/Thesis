const { getGenerationById, getGenerations } = require("../generations.controller");
const { listGenerations, listModels } = require("../../db");

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

describe("getGenerations", () => {
	test("returns 200 with every generation when no modelId is given", () => {
		const req = { query: {} };
		const res = mockRes();

		getGenerations(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const [payload] = res.json.mock.calls[0];
		expect(payload.model).toBeNull();
		expect(payload.generations.length).toBeGreaterThan(0);
	});

	test("returns 200 with the model and its generations for a real modelId", () => {
		const [model] = listModels();
		const req = { query: { modelId: String(model.id) } };
		const res = mockRes();

		getGenerations(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const [payload] = res.json.mock.calls[0];
		expect(payload.model).toEqual(model);
		expect(payload.generations.every((g) => g.modelId === model.id)).toBe(true);
	});

	test("returns 404 for a non-existent modelId", () => {
		const req = { query: { modelId: "999999" } };
		const res = mockRes();

		getGenerations(req, res);

		expect(res.status).toHaveBeenCalledWith(404);
	});
});

describe("getGenerationById", () => {
	test("returns 200 with the generation and its parent model for a real id", () => {
		const [generation] = listGenerations();
		const req = { params: { id: String(generation.id) } };
		const res = mockRes();

		getGenerationById(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const [payload] = res.json.mock.calls[0];
		expect(payload.generation).toEqual(generation);
		expect(payload.model.id).toBe(generation.modelId);
	});

	test("returns 404 for a non-existent id", () => {
		const req = { params: { id: "999999" } };
		const res = mockRes();

		getGenerationById(req, res);

		expect(res.status).toHaveBeenCalledWith(404);
	});
});
