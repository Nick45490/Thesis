const { getManufacturerById, getManufacturerModels, getManufacturers } = require("../manufacturers.controller");
const { listManufacturers } = require("../../db");

function mockRes() {
	const res = {};
	res.status = jest.fn().mockReturnValue(res);
	res.json = jest.fn().mockReturnValue(res);
	return res;
}

describe("getManufacturers", () => {
	test("returns 200 with every manufacturer when no query is given", () => {
		const req = { query: {} };
		const res = mockRes();

		getManufacturers(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const [payload] = res.json.mock.calls[0];
		expect(payload.manufacturers.length).toBeGreaterThan(0);
	});

	test("filters by the q query param", () => {
		const req = { query: { q: "bmw" } };
		const res = mockRes();

		getManufacturers(req, res);

		const [payload] = res.json.mock.calls[0];
		expect(payload.manufacturers.every((m) => m.name.toLowerCase().includes("bmw"))).toBe(true);
	});
});

describe("getManufacturerById", () => {
	test("returns 200 with the manufacturer for a real id", () => {
		const [existing] = listManufacturers();
		const req = { params: { id: String(existing.id) } };
		const res = mockRes();

		getManufacturerById(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const [payload] = res.json.mock.calls[0];
		expect(payload.manufacturer).toEqual(existing);
	});

	test("returns 404 for a non-existent id", () => {
		const req = { params: { id: "999999" } };
		const res = mockRes();

		getManufacturerById(req, res);

		expect(res.status).toHaveBeenCalledWith(404);
	});
});

describe("getManufacturerModels", () => {
	test("returns 200 with the manufacturer and its models for a real id", () => {
		const [existing] = listManufacturers();
		const req = { params: { id: String(existing.id) }, query: {} };
		const res = mockRes();

		getManufacturerModels(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const [payload] = res.json.mock.calls[0];
		expect(payload.manufacturer).toEqual(existing);
		expect(payload.models.every((m) => m.manufacturerId === existing.id)).toBe(true);
	});

	test("returns 404 for a non-existent manufacturer id, without ever computing models", () => {
		const req = { params: { id: "999999" }, query: {} };
		const res = mockRes();

		getManufacturerModels(req, res);

		expect(res.status).toHaveBeenCalledWith(404);
		const [payload] = res.json.mock.calls[0];
		expect(payload.models).toBeUndefined();
	});
});
