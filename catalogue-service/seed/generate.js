// Run with: node generate.js
// Writes data.json in the same directory

const fs = require("fs");
const path = require("path");

let modelId = 1001;
let genId = 10001;

const manufacturers = [];
const models = [];
const generations = [];

function mfr(id, name, country) {
	manufacturers.push({ id, name, country });
}

function model(mfrId, name, segment) {
	const id = modelId++;
	models.push({ id, manufacturerId: mfrId, name, segment });
	return id;
}

function gen(mId, code, startYear, endYear, drivetrain) {
	generations.push({ id: genId++, modelId: mId, code, startYear, endYear: endYear ?? null, drivetrain });
}

// ── Manufacturers ──────────────────────────────────────────────────────────────
mfr(1,  "Volkswagen",     "Germany");
mfr(2,  "BMW",            "Germany");
mfr(3,  "Mercedes-Benz",  "Germany");
mfr(4,  "Opel",           "Germany");
mfr(5,  "Ford",           "Germany");
mfr(6,  "Renault",        "France");
mfr(7,  "Peugeot",        "France");
mfr(8,  "Citroën",        "France");
mfr(9,  "Dacia",          "Romania");
mfr(10, "Skoda",          "Czech Republic");
mfr(11, "SEAT",           "Spain");
mfr(12, "Fiat",           "Italy");
mfr(13, "Audi",           "Germany");
mfr(14, "Alfa Romeo",     "Italy");
mfr(15, "Volvo",          "Sweden");
mfr(16, "Mini",           "United Kingdom");
mfr(17, "Porsche",        "Germany");
mfr(18, "Land Rover",     "United Kingdom");
mfr(19, "Jaguar",         "United Kingdom");
mfr(20, "Smart",          "Germany");
mfr(21, "DS Automobiles", "France");
mfr(22, "Cupra",          "Spain");
mfr(23, "Saab",           "Sweden");
mfr(24, "Lancia",         "Italy");
mfr(25, "Ferrari",        "Italy");
mfr(26, "Lamborghini",    "Italy");
mfr(27, "Maserati",       "Italy");
mfr(28, "Bentley",        "United Kingdom");
mfr(29, "Rolls-Royce",    "United Kingdom");
mfr(30, "Aston Martin",   "United Kingdom");
mfr(31, "McLaren",        "United Kingdom");
mfr(32, "Lotus",          "United Kingdom");
mfr(33, "Polestar",       "Sweden");
mfr(34, "MG",             "United Kingdom");
mfr(35, "Daewoo",         "South Korea");
mfr(36, "Rover",          "United Kingdom");
mfr(37, "Toyota",         "Japan");
mfr(38, "Honda",          "Japan");
mfr(39, "Hyundai",        "South Korea");
mfr(40, "Kia",            "South Korea");
mfr(41, "Nissan",         "Japan");
mfr(42, "Mazda",          "Japan");
mfr(43, "Mitsubishi",     "Japan");
mfr(44, "Suzuki",         "Japan");
mfr(45, "Subaru",         "Japan");
mfr(46, "Lexus",          "Japan");
mfr(47, "Jeep",           "USA");
mfr(48, "Chevrolet",      "USA");
mfr(49, "Dodge",          "USA");
mfr(50, "Chrysler",       "USA");
mfr(51, "RAM",            "USA");
mfr(52, "Cadillac",       "USA");
mfr(53, "Tesla",          "USA");
mfr(54, "Genesis",        "South Korea");

// ── Volkswagen (1) ─────────────────────────────────────────────────────────────
{ const m = model(1, "Golf",         "Hatchback"); gen(m,"Mk6",2008,2012,"FWD"); gen(m,"Mk7",2012,2019,"FWD/AWD"); gen(m,"Mk8",2019,null,"FWD/AWD"); }
{ const m = model(1, "Passat",       "Sedan");     gen(m,"B7",2010,2014,"FWD/AWD"); gen(m,"B8",2014,2023,"FWD/AWD"); gen(m,"B9",2023,null,"FWD/AWD"); }
{ const m = model(1, "Polo",         "Supermini"); gen(m,"Mk5",2009,2017,"FWD"); gen(m,"Mk6",2017,null,"FWD"); }
{ const m = model(1, "Tiguan",       "SUV");       gen(m,"Mk1",2007,2016,"FWD/AWD"); gen(m,"Mk2",2016,2023,"FWD/AWD"); gen(m,"Mk3",2023,null,"FWD/AWD"); }
{ const m = model(1, "Touareg",      "SUV");       gen(m,"7P",2010,2018,"AWD"); gen(m,"CR",2018,null,"AWD"); }
{ const m = model(1, "T-Roc",        "Crossover"); gen(m,"A1",2017,null,"FWD/AWD"); }
{ const m = model(1, "Arteon",       "Sedan");     gen(m,"3H",2017,null,"FWD/AWD"); }
{ const m = model(1, "Sharan",       "MPV");       gen(m,"7N",2010,null,"FWD"); }
{ const m = model(1, "ID.3",         "Hatchback"); gen(m,"E11",2019,null,"RWD"); }
{ const m = model(1, "ID.4",         "SUV");       gen(m,"E21",2020,null,"RWD/AWD"); }
{ const m = model(1, "Touran",       "MPV");       gen(m,"1T",2003,2010,"FWD"); gen(m,"5T",2015,null,"FWD"); }
{ const m = model(1, "T-Cross",      "Crossover"); gen(m,"C11",2018,null,"FWD"); }
{ const m = model(1, "Taigo",        "Crossover"); gen(m,"CS2",2021,null,"FWD"); }
{ const m = model(1, "ID.5",         "SUV");       gen(m,"E39",2021,null,"RWD/AWD"); }
{ const m = model(1, "ID.7",         "Sedan");     gen(m,"E3",2023,null,"RWD/AWD"); }
{ const m = model(1, "up!",          "Supermini"); gen(m,"AA",2011,null,"FWD"); }
{ const m = model(1, "Golf Variant", "Estate");    gen(m,"Mk7",2013,2020,"FWD/AWD"); gen(m,"Mk8",2020,null,"FWD/AWD"); }
{ const m = model(1, "Caddy",        "MPV");       gen(m,"III",2003,2015,"FWD/AWD"); gen(m,"IV",2015,2020,"FWD/AWD"); gen(m,"V",2020,null,"FWD/AWD"); }

// ── BMW (2) ────────────────────────────────────────────────────────────────────
{ const m = model(2, "3 Series",    "Sedan");      gen(m,"F30",2011,2018,"RWD/AWD"); gen(m,"G20",2018,null,"RWD/AWD"); }
{ const m = model(2, "5 Series",    "Sedan");      gen(m,"F10",2010,2016,"RWD/AWD"); gen(m,"G30",2016,null,"RWD/AWD"); }
{ const m = model(2, "1 Series",    "Hatchback");  gen(m,"F20",2011,2019,"RWD"); gen(m,"F40",2019,null,"FWD/AWD"); }
{ const m = model(2, "X3",          "SUV");        gen(m,"F25",2010,2017,"RWD/AWD"); gen(m,"G01",2017,null,"RWD/AWD"); }
{ const m = model(2, "X5",          "SUV");        gen(m,"F15",2013,2018,"RWD/AWD"); gen(m,"G05",2018,null,"RWD/AWD"); }
{ const m = model(2, "M3",          "Sedan");      gen(m,"F80",2014,2018,"RWD"); gen(m,"G80",2020,null,"RWD/AWD"); }
{ const m = model(2, "7 Series",    "Luxury");     gen(m,"F01",2008,2015,"RWD/AWD"); gen(m,"G11",2015,2022,"RWD/AWD"); gen(m,"G70",2022,null,"RWD/AWD"); }
{ const m = model(2, "2 Series",    "Coupe");      gen(m,"F22",2013,2021,"RWD/AWD"); gen(m,"G42",2021,null,"RWD/AWD"); }
{ const m = model(2, "X1",          "Crossover");  gen(m,"F48",2015,2022,"FWD/AWD"); gen(m,"U11",2022,null,"FWD/AWD"); }
{ const m = model(2, "4 Series",    "Coupe");      gen(m,"G22",2020,null,"RWD/AWD"); }
{ const m = model(2, "X2",          "Crossover");  gen(m,"F39",2018,2023,"FWD/AWD"); gen(m,"U10",2023,null,"FWD/AWD"); }
{ const m = model(2, "X4",          "SUV");        gen(m,"F26",2014,2018,"RWD/AWD"); gen(m,"G02",2018,null,"RWD/AWD"); }
{ const m = model(2, "X6",          "SUV");        gen(m,"E71",2008,2014,"AWD"); gen(m,"F16",2014,2019,"AWD"); gen(m,"G06",2019,null,"AWD"); }
{ const m = model(2, "X7",          "SUV");        gen(m,"G07",2018,null,"AWD"); }
{ const m = model(2, "M2",          "Coupe");      gen(m,"F87",2015,2021,"RWD"); gen(m,"G87",2022,null,"RWD"); }
{ const m = model(2, "M4",          "Coupe");      gen(m,"F82",2014,2020,"RWD"); gen(m,"G82",2020,null,"RWD/AWD"); }
{ const m = model(2, "M5",          "Sedan");      gen(m,"F90",2017,2024,"AWD"); gen(m,"G90",2024,null,"AWD"); }
{ const m = model(2, "Z4",          "Convertible");gen(m,"E89",2009,2016,"RWD"); gen(m,"G29",2018,null,"RWD"); }
{ const m = model(2, "i3",          "Hatchback");  gen(m,"I01",2013,2022,"RWD"); }
{ const m = model(2, "i4",          "Sedan");      gen(m,"G26",2021,null,"RWD/AWD"); }
{ const m = model(2, "iX",          "SUV");        gen(m,"I20",2021,null,"AWD"); }
{ const m = model(2, "8 Series",    "Coupe");      gen(m,"G15",2018,null,"RWD/AWD"); }
{ const m = model(2, "6 Series GT", "Sedan");      gen(m,"G32",2017,2023,"RWD/AWD"); }
{ const m = model(2, "iX1",         "Crossover");  gen(m,"U11e",2022,null,"FWD/AWD"); }
{ const m = model(2, "iX3",         "SUV");        gen(m,"G08",2020,null,"RWD"); }

// ── Mercedes-Benz (3) ──────────────────────────────────────────────────────────
{ const m = model(3, "C-Class",    "Sedan");     gen(m,"W204",2007,2014,"RWD/AWD"); gen(m,"W205",2014,2021,"RWD/AWD"); gen(m,"W206",2021,null,"RWD/AWD"); }
{ const m = model(3, "E-Class",    "Sedan");     gen(m,"W212",2009,2016,"RWD/AWD"); gen(m,"W213",2016,2023,"RWD/AWD"); gen(m,"W214",2023,null,"RWD/AWD"); }
{ const m = model(3, "A-Class",    "Hatchback"); gen(m,"W176",2012,2018,"FWD/AWD"); gen(m,"W177",2018,null,"FWD/AWD"); }
{ const m = model(3, "GLC",        "SUV");       gen(m,"X253",2015,2022,"RWD/AWD"); gen(m,"X254",2022,null,"RWD/AWD"); }
{ const m = model(3, "GLE",        "SUV");       gen(m,"W166",2015,2018,"RWD/AWD"); gen(m,"V167",2018,null,"RWD/AWD"); }
{ const m = model(3, "S-Class",    "Luxury");    gen(m,"W221",2005,2013,"RWD/AWD"); gen(m,"W222",2013,2020,"RWD/AWD"); gen(m,"W223",2020,null,"RWD/AWD"); }
{ const m = model(3, "CLA",        "Coupe");     gen(m,"C117",2013,2019,"FWD/AWD"); gen(m,"C118",2019,null,"FWD/AWD"); }
{ const m = model(3, "GLA",        "Crossover"); gen(m,"X156",2013,2019,"FWD/AWD"); gen(m,"H247",2020,null,"FWD/AWD"); }
{ const m = model(3, "B-Class",    "MPV");       gen(m,"W246",2011,2018,"FWD"); gen(m,"W247",2018,null,"FWD"); }
{ const m = model(3, "GLS",        "SUV");       gen(m,"X166",2016,2019,"RWD/AWD"); gen(m,"X167",2019,null,"RWD/AWD"); }
{ const m = model(3, "CLS",        "Coupe");     gen(m,"W218",2010,2018,"RWD/AWD"); gen(m,"C257",2018,null,"RWD/AWD"); }
{ const m = model(3, "GLB",        "SUV");       gen(m,"X247",2019,null,"FWD/AWD"); }
{ const m = model(3, "EQA",        "Crossover"); gen(m,"H243",2021,null,"FWD/AWD"); }
{ const m = model(3, "EQB",        "SUV");       gen(m,"X243",2021,null,"FWD/AWD"); }
{ const m = model(3, "EQC",        "SUV");       gen(m,"N293",2019,2023,"AWD"); }
{ const m = model(3, "EQE",        "Sedan");     gen(m,"V295",2022,null,"RWD/AWD"); }
{ const m = model(3, "EQS",        "Luxury");    gen(m,"V297",2021,null,"RWD/AWD"); }
{ const m = model(3, "SL",         "Convertible");gen(m,"R230",2002,2012,"RWD"); gen(m,"R231",2012,2021,"RWD/AWD"); gen(m,"R232",2021,null,"AWD"); }
{ const m = model(3, "SLC",        "Sports");    gen(m,"R172",2016,2020,"RWD"); }
{ const m = model(3, "AMG GT",     "Sports");    gen(m,"C190",2014,2023,"RWD/AWD"); gen(m,"X290",2023,null,"AWD"); }
{ const m = model(3, "GLK",        "Crossover"); gen(m,"X204",2008,2015,"RWD/AWD"); }
{ const m = model(3, "GLC Coupe",  "SUV");       gen(m,"C253",2016,2022,"RWD/AWD"); gen(m,"C254",2022,null,"RWD/AWD"); }

// ── Opel (4) ───────────────────────────────────────────────────────────────────
{ const m = model(4, "Astra",      "Hatchback"); gen(m,"H",2004,2009,"FWD"); gen(m,"J",2009,2015,"FWD"); gen(m,"K",2015,2021,"FWD"); gen(m,"L",2021,null,"FWD/AWD"); }
{ const m = model(4, "Corsa",      "Supermini"); gen(m,"D",2006,2014,"FWD"); gen(m,"E",2014,2019,"FWD"); gen(m,"F",2019,null,"FWD"); }
{ const m = model(4, "Insignia",   "Sedan");     gen(m,"A",2008,2017,"FWD/AWD"); gen(m,"B",2017,null,"FWD/AWD"); }
{ const m = model(4, "Mokka",      "Crossover"); gen(m,"A",2012,2019,"FWD/AWD"); gen(m,"B",2020,null,"FWD/AWD"); }
{ const m = model(4, "Zafira",     "MPV");       gen(m,"B",2005,2014,"FWD"); gen(m,"C",2011,2019,"FWD"); }
{ const m = model(4, "Vectra",     "Sedan");     gen(m,"C",2002,2008,"FWD/AWD"); }
{ const m = model(4, "Crossland",  "Crossover"); gen(m,"X",2017,null,"FWD"); }
{ const m = model(4, "Grandland",  "SUV");       gen(m,"X",2017,null,"FWD/AWD"); }
{ const m = model(4, "Meriva",     "MPV");       gen(m,"A",2003,2010,"FWD"); gen(m,"B",2010,2017,"FWD"); }
{ const m = model(4, "Antara",     "Crossover"); gen(m,"I",2006,2015,"FWD/AWD"); }
{ const m = model(4, "Adam",       "Supermini"); gen(m,"I",2012,2019,"FWD"); }
{ const m = model(4, "Cascada",    "Convertible");gen(m,"I",2013,2019,"FWD"); }
{ const m = model(4, "Combo",      "MPV");       gen(m,"D",2018,null,"FWD"); }
{ const m = model(4, "Mokka-e",    "Crossover"); gen(m,"B",2020,null,"FWD"); }
{ const m = model(4, "Frontera",   "SUV");       gen(m,"I",2024,null,"FWD/AWD"); }

// ── Ford (5) ───────────────────────────────────────────────────────────────────
{ const m = model(5, "Focus",      "Hatchback"); gen(m,"Mk2",2004,2011,"FWD"); gen(m,"Mk3",2011,2018,"FWD"); gen(m,"Mk4",2018,null,"FWD"); }
{ const m = model(5, "Fiesta",     "Supermini"); gen(m,"Mk6",2008,2017,"FWD"); gen(m,"Mk7",2017,2023,"FWD"); }
{ const m = model(5, "Mondeo",     "Sedan");     gen(m,"Mk4",2007,2014,"FWD/AWD"); gen(m,"Mk5",2014,2022,"FWD/AWD"); }
{ const m = model(5, "Kuga",       "SUV");       gen(m,"Mk1",2008,2012,"FWD/AWD"); gen(m,"Mk2",2012,2019,"FWD/AWD"); gen(m,"Mk3",2019,null,"FWD/AWD"); }
{ const m = model(5, "Puma",       "Crossover"); gen(m,"Mk2",2019,null,"FWD"); }
{ const m = model(5, "EcoSport",   "Crossover"); gen(m,"Mk2",2013,2022,"FWD/AWD"); }
{ const m = model(5, "S-MAX",      "MPV");       gen(m,"Mk1",2006,2015,"FWD/AWD"); gen(m,"Mk2",2015,null,"FWD/AWD"); }
{ const m = model(5, "Galaxy",     "MPV");       gen(m,"Mk3",2006,2015,"FWD"); gen(m,"Mk4",2015,null,"FWD"); }
{ const m = model(5, "Mustang",    "Coupe");     gen(m,"S550",2014,2023,"RWD"); gen(m,"S650",2023,null,"RWD/AWD"); }
{ const m = model(5, "Ranger",     "Pickup");    gen(m,"T6",2011,2022,"RWD/4WD"); gen(m,"T7",2022,null,"RWD/4WD"); }
{ const m = model(5, "C-MAX",      "MPV");       gen(m,"Mk1",2003,2010,"FWD"); gen(m,"Mk2",2010,2019,"FWD"); }
{ const m = model(5, "Edge",       "SUV");       gen(m,"Mk1",2006,2014,"FWD/AWD"); gen(m,"Mk2",2014,null,"FWD/AWD"); }
{ const m = model(5, "Explorer",   "SUV");       gen(m,"U502",2010,2019,"FWD/AWD"); gen(m,"U625",2019,null,"RWD/AWD"); }
{ const m = model(5, "Bronco",     "SUV");       gen(m,"VI",2021,null,"4WD"); }
{ const m = model(5, "Mustang Mach-E","SUV");    gen(m,"I",2020,null,"RWD/AWD"); }
{ const m = model(5, "Transit Custom","MPV");    gen(m,"I",2012,null,"FWD"); }

// ── Renault (6) ────────────────────────────────────────────────────────────────
{ const m = model(6, "Clio",       "Supermini"); gen(m,"III",2005,2012,"FWD"); gen(m,"IV",2012,2019,"FWD"); gen(m,"V",2019,null,"FWD"); }
{ const m = model(6, "Megane",     "Hatchback"); gen(m,"III",2008,2015,"FWD"); gen(m,"IV",2015,null,"FWD"); }
{ const m = model(6, "Captur",     "Crossover"); gen(m,"I",2013,2019,"FWD"); gen(m,"II",2019,null,"FWD/AWD"); }
{ const m = model(6, "Kadjar",     "SUV");       gen(m,"I",2015,2022,"FWD/AWD"); }
{ const m = model(6, "Koleos",     "SUV");       gen(m,"I",2008,2017,"FWD/AWD"); gen(m,"II",2017,null,"FWD/AWD"); }
{ const m = model(6, "Zoe",        "Hatchback"); gen(m,"I",2012,2019,"FWD"); gen(m,"II",2019,null,"FWD"); }
{ const m = model(6, "Talisman",   "Sedan");     gen(m,"I",2015,2022,"FWD/AWD"); }
{ const m = model(6, "Scenic",     "MPV");       gen(m,"III",2009,2016,"FWD"); gen(m,"IV",2016,2022,"FWD"); gen(m,"V",2023,null,"FWD/AWD"); }
{ const m = model(6, "Twingo",     "Supermini"); gen(m,"III",2014,null,"RWD"); }
{ const m = model(6, "Kangoo",     "MPV");       gen(m,"II",2007,2021,"FWD"); gen(m,"III",2021,null,"FWD"); }
{ const m = model(6, "Austral",    "SUV");       gen(m,"I",2022,null,"FWD/AWD"); }
{ const m = model(6, "Arkana",     "Crossover"); gen(m,"I",2019,null,"FWD"); }
{ const m = model(6, "Espace",     "MPV");       gen(m,"IV",2014,2022,"FWD"); gen(m,"V",2023,null,"FWD/AWD"); }
{ const m = model(6, "Symbol",     "Sedan");     gen(m,"II",2008,2016,"FWD"); gen(m,"III",2016,null,"FWD"); }
{ const m = model(6, "Fluence",    "Sedan");     gen(m,"I",2009,2016,"FWD"); }
{ const m = model(6, "Megane E-Tech","Hatchback");gen(m,"I",2021,null,"FWD"); }
{ const m = model(6, "Rafale",     "Crossover"); gen(m,"I",2023,null,"FWD/AWD"); }

// ── Peugeot (7) ────────────────────────────────────────────────────────────────
{ const m = model(7, "208",        "Supermini"); gen(m,"I",2012,2019,"FWD"); gen(m,"II",2019,null,"FWD/AWD"); }
{ const m = model(7, "308",        "Hatchback"); gen(m,"II",2013,2021,"FWD"); gen(m,"III",2021,null,"FWD/AWD"); }
{ const m = model(7, "508",        "Sedan");     gen(m,"I",2011,2018,"FWD"); gen(m,"II",2018,null,"FWD/AWD"); }
{ const m = model(7, "2008",       "Crossover"); gen(m,"I",2013,2019,"FWD"); gen(m,"II",2019,null,"FWD/AWD"); }
{ const m = model(7, "3008",       "SUV");       gen(m,"I",2009,2016,"FWD"); gen(m,"II",2016,null,"FWD/AWD"); }
{ const m = model(7, "5008",       "SUV");       gen(m,"I",2009,2017,"FWD"); gen(m,"II",2017,null,"FWD/AWD"); }
{ const m = model(7, "407",        "Sedan");     gen(m,"I",2004,2010,"FWD"); }
{ const m = model(7, "107",        "Supermini"); gen(m,"I",2005,2014,"FWD"); }
{ const m = model(7, "108",        "Supermini"); gen(m,"I",2014,2022,"FWD"); }
{ const m = model(7, "Partner",    "MPV");       gen(m,"II",2008,2018,"FWD"); gen(m,"III",2018,null,"FWD"); }
{ const m = model(7, "206",        "Supermini"); gen(m,"I",2000,2009,"FWD"); }
{ const m = model(7, "207",        "Supermini"); gen(m,"I",2006,2012,"FWD"); }
{ const m = model(7, "307",        "Hatchback"); gen(m,"I",2001,2008,"FWD"); }
{ const m = model(7, "408",        "Crossover"); gen(m,"I",2022,null,"FWD/AWD"); }
{ const m = model(7, "RCZ",        "Sports");    gen(m,"I",2010,2015,"FWD"); }
{ const m = model(7, "Rifter",     "MPV");       gen(m,"I",2018,null,"FWD"); }
{ const m = model(7, "4008",       "Crossover"); gen(m,"I",2012,2017,"FWD/AWD"); }

// ── Citroën (8) ────────────────────────────────────────────────────────────────
{ const m = model(8, "C3",              "Supermini"); gen(m,"II",2009,2016,"FWD"); gen(m,"III",2016,null,"FWD"); }
{ const m = model(8, "C4",              "Hatchback"); gen(m,"II",2010,2018,"FWD"); gen(m,"III",2020,null,"FWD/AWD"); }
{ const m = model(8, "C5",              "Sedan");     gen(m,"II",2007,2017,"FWD"); }
{ const m = model(8, "Berlingo",        "MPV");       gen(m,"II",2008,2018,"FWD"); gen(m,"III",2018,null,"FWD"); }
{ const m = model(8, "C5 Aircross",     "SUV");       gen(m,"I",2017,null,"FWD/AWD"); }
{ const m = model(8, "C3 Aircross",     "Crossover"); gen(m,"I",2017,null,"FWD"); }
{ const m = model(8, "C-Picasso",       "MPV");       gen(m,"II",2013,2016,"FWD"); }
{ const m = model(8, "Grand C-Picasso", "MPV");       gen(m,"II",2013,2016,"FWD"); }
{ const m = model(8, "C-Elysée",        "Sedan");     gen(m,"I",2012,null,"FWD"); }
{ const m = model(8, "C1",              "Supermini"); gen(m,"II",2014,2022,"FWD"); }
{ const m = model(8, "C4 Cactus",       "Crossover"); gen(m,"I",2014,2018,"FWD"); }
{ const m = model(8, "C2",              "Supermini"); gen(m,"I",2003,2009,"FWD"); }
{ const m = model(8, "C4 SpaceTourer",  "MPV");       gen(m,"I",2013,2021,"FWD"); }
{ const m = model(8, "C5 X",            "Crossover"); gen(m,"I",2021,null,"FWD/AWD"); }

// ── Dacia (9) ──────────────────────────────────────────────────────────────────
{ const m = model(9, "Logan",      "Sedan");     gen(m,"I",2004,2012,"FWD"); gen(m,"II",2012,2020,"FWD"); gen(m,"III",2020,null,"FWD"); }
{ const m = model(9, "Sandero",    "Hatchback"); gen(m,"I",2008,2012,"FWD"); gen(m,"II",2012,2020,"FWD"); gen(m,"III",2020,null,"FWD"); }
{ const m = model(9, "Duster",     "SUV");       gen(m,"I",2010,2017,"FWD/AWD"); gen(m,"II",2017,null,"FWD/AWD"); }
{ const m = model(9, "Lodgy",      "MPV");       gen(m,"I",2012,null,"FWD"); }
{ const m = model(9, "Dokker",     "MPV");       gen(m,"I",2012,null,"FWD"); }
{ const m = model(9, "Logan MCV",  "Estate");    gen(m,"II",2013,2020,"FWD"); }
{ const m = model(9, "Jogger",     "MPV");       gen(m,"I",2021,null,"FWD"); }
{ const m = model(9, "Spring",     "Hatchback"); gen(m,"I",2021,null,"FWD"); }
{ const m = model(9, "Bigster",    "SUV");       gen(m,"I",2025,null,"FWD/AWD"); }

// ── Skoda (10) ─────────────────────────────────────────────────────────────────
{ const m = model(10, "Octavia",   "Hatchback"); gen(m,"II",2004,2013,"FWD/AWD"); gen(m,"III",2012,2020,"FWD/AWD"); gen(m,"IV",2019,null,"FWD/AWD"); }
{ const m = model(10, "Fabia",     "Supermini"); gen(m,"II",2007,2014,"FWD"); gen(m,"III",2014,2021,"FWD"); gen(m,"IV",2021,null,"FWD"); }
{ const m = model(10, "Superb",    "Sedan");     gen(m,"II",2008,2015,"FWD/AWD"); gen(m,"III",2015,null,"FWD/AWD"); }
{ const m = model(10, "Kodiaq",    "SUV");       gen(m,"I",2016,2023,"FWD/AWD"); gen(m,"II",2023,null,"FWD/AWD"); }
{ const m = model(10, "Karoq",     "Crossover"); gen(m,"I",2017,null,"FWD/AWD"); }
{ const m = model(10, "Yeti",      "Crossover"); gen(m,"I",2009,2017,"FWD/AWD"); }
{ const m = model(10, "Rapid",     "Sedan");     gen(m,"I",2012,2019,"FWD"); }
{ const m = model(10, "Scala",     "Hatchback"); gen(m,"I",2018,null,"FWD"); }
{ const m = model(10, "Enyaq",     "SUV");       gen(m,"I",2020,null,"RWD/AWD"); }
{ const m = model(10, "Kamiq",     "Crossover"); gen(m,"I",2019,null,"FWD"); }
{ const m = model(10, "Citigo",    "Supermini"); gen(m,"I",2011,2020,"FWD"); }
{ const m = model(10, "Elroq",     "SUV");       gen(m,"I",2024,null,"RWD/AWD"); }

// ── SEAT (11) ──────────────────────────────────────────────────────────────────
{ const m = model(11, "Leon",      "Hatchback"); gen(m,"II",2005,2012,"FWD"); gen(m,"III",2012,2020,"FWD/AWD"); gen(m,"IV",2020,null,"FWD/AWD"); }
{ const m = model(11, "Ibiza",     "Supermini"); gen(m,"IV",2008,2017,"FWD"); gen(m,"V",2017,null,"FWD"); }
{ const m = model(11, "Ateca",     "SUV");       gen(m,"I",2016,null,"FWD/AWD"); }
{ const m = model(11, "Arona",     "Crossover"); gen(m,"I",2017,null,"FWD"); }
{ const m = model(11, "Tarraco",   "SUV");       gen(m,"I",2018,null,"FWD/AWD"); }
{ const m = model(11, "Toledo",    "Sedan");     gen(m,"III",2004,2009,"FWD"); gen(m,"IV",2012,2019,"FWD"); }
{ const m = model(11, "Altea",     "MPV");       gen(m,"I",2004,2015,"FWD"); }
{ const m = model(11, "Mii",       "Supermini"); gen(m,"I",2011,2019,"FWD"); }
{ const m = model(11, "Alhambra",  "MPV");       gen(m,"II",2010,2022,"FWD/AWD"); }
{ const m = model(11, "Exeo",      "Sedan");     gen(m,"I",2008,2013,"FWD"); }

// ── Fiat (12) ──────────────────────────────────────────────────────────────────
{ const m = model(12, "Punto",     "Supermini"); gen(m,"Grande",2005,2018,"FWD"); }
{ const m = model(12, "Bravo",     "Hatchback"); gen(m,"II",2007,2014,"FWD"); }
{ const m = model(12, "500",       "Supermini"); gen(m,"III",2007,null,"FWD"); }
{ const m = model(12, "Panda",     "Supermini"); gen(m,"II",2003,2011,"FWD"); gen(m,"III",2011,null,"FWD/AWD"); }
{ const m = model(12, "Tipo",      "Hatchback"); gen(m,"II",2015,null,"FWD"); }
{ const m = model(12, "500X",      "Crossover"); gen(m,"I",2014,null,"FWD/AWD"); }
{ const m = model(12, "Doblo",     "MPV");       gen(m,"II",2009,2021,"FWD"); gen(m,"III",2021,null,"FWD"); }
{ const m = model(12, "Stilo",     "Hatchback"); gen(m,"I",2001,2007,"FWD"); }
{ const m = model(12, "500L",      "MPV");       gen(m,"I",2012,null,"FWD"); }
{ const m = model(12, "Freemont",  "MPV");       gen(m,"I",2011,2016,"FWD/AWD"); }
{ const m = model(12, "500e",      "Supermini"); gen(m,"IV",2020,null,"FWD"); }
{ const m = model(12, "Croma",     "Hatchback"); gen(m,"II",2005,2011,"FWD"); }
{ const m = model(12, "Sedici",    "Crossover"); gen(m,"I",2006,2014,"FWD/AWD"); }
{ const m = model(12, "Linea",     "Sedan");     gen(m,"I",2007,2017,"FWD"); }
{ const m = model(12, "600",       "Crossover"); gen(m,"I",2023,null,"FWD/AWD"); }

// ── Audi (13) ──────────────────────────────────────────────────────────────────
{ const m = model(13, "A3",        "Hatchback"); gen(m,"8P",2003,2012,"FWD/AWD"); gen(m,"8V",2012,2020,"FWD/AWD"); gen(m,"8Y",2020,null,"FWD/AWD"); }
{ const m = model(13, "A4",        "Sedan");     gen(m,"B7",2004,2008,"FWD/AWD"); gen(m,"B8",2007,2015,"FWD/AWD"); gen(m,"B9",2015,null,"FWD/AWD"); }
{ const m = model(13, "A6",        "Sedan");     gen(m,"C6",2004,2011,"FWD/AWD"); gen(m,"C7",2011,2018,"FWD/AWD"); gen(m,"C8",2018,null,"FWD/AWD"); }
{ const m = model(13, "Q3",        "Crossover"); gen(m,"8U",2011,2018,"FWD/AWD"); gen(m,"F3",2018,null,"FWD/AWD"); }
{ const m = model(13, "Q5",        "SUV");       gen(m,"8R",2008,2016,"AWD"); gen(m,"FY",2016,null,"AWD"); }
{ const m = model(13, "A5",        "Coupe");     gen(m,"8T",2007,2016,"FWD/AWD"); gen(m,"F5",2016,null,"FWD/AWD"); }
{ const m = model(13, "Q7",        "SUV");       gen(m,"4L",2005,2015,"AWD"); gen(m,"4M",2015,null,"AWD"); }
{ const m = model(13, "A1",        "Supermini"); gen(m,"8X",2010,2018,"FWD"); gen(m,"GB",2018,null,"FWD"); }
{ const m = model(13, "TT",        "Coupe");     gen(m,"8J",2006,2014,"FWD/AWD"); gen(m,"8S",2014,2023,"FWD/AWD"); }
{ const m = model(13, "Q2",        "Crossover"); gen(m,"GA",2016,null,"FWD/AWD"); }
{ const m = model(13, "A7",        "Hatchback"); gen(m,"4G",2010,2018,"FWD/AWD"); gen(m,"4K",2018,null,"FWD/AWD"); }
{ const m = model(13, "A8",        "Luxury");    gen(m,"D4",2009,2017,"RWD/AWD"); gen(m,"D5",2017,null,"AWD"); }
{ const m = model(13, "Q8",        "SUV");       gen(m,"F1",2018,null,"AWD"); }
{ const m = model(13, "e-tron",    "SUV");       gen(m,"GE",2018,2023,"AWD"); }
{ const m = model(13, "e-tron GT", "Sedan");     gen(m,"F8",2021,null,"AWD"); }
{ const m = model(13, "R8",        "Supercar");  gen(m,"42",2006,2015,"RWD/AWD"); gen(m,"4S",2015,2023,"RWD/AWD"); }
{ const m = model(13, "RS6 Avant", "Estate");    gen(m,"C7",2013,2018,"AWD"); gen(m,"C8",2019,null,"AWD"); }
{ const m = model(13, "Q4 e-tron", "Crossover"); gen(m,"F4B",2021,null,"RWD/AWD"); }
{ const m = model(13, "Q6 e-tron", "SUV");       gen(m,"F1e",2024,null,"AWD"); }

// ── Alfa Romeo (14) ────────────────────────────────────────────────────────────
{ const m = model(14, "147",        "Hatchback");  gen(m,"I",2000,2010,"FWD"); }
{ const m = model(14, "156",        "Sedan");      gen(m,"I",2000,2007,"FWD"); }
{ const m = model(14, "159",        "Sedan");      gen(m,"I",2005,2011,"FWD/AWD"); }
{ const m = model(14, "Giulietta",  "Hatchback");  gen(m,"I",2010,2020,"FWD"); }
{ const m = model(14, "Giulia",     "Sedan");      gen(m,"I",2016,null,"RWD/AWD"); }
{ const m = model(14, "Stelvio",    "SUV");        gen(m,"I",2017,null,"RWD/AWD"); }
{ const m = model(14, "MiTo",       "Supermini");  gen(m,"I",2008,2018,"FWD"); }
{ const m = model(14, "Tonale",     "Crossover");  gen(m,"I",2022,null,"FWD/AWD"); }
{ const m = model(14, "Spider",     "Convertible");gen(m,"939",2006,2010,"FWD/AWD"); }
{ const m = model(14, "GT",         "Coupe");      gen(m,"I",2003,2010,"FWD"); }
{ const m = model(14, "Brera",      "Coupe");      gen(m,"I",2005,2010,"FWD/AWD"); }
{ const m = model(14, "4C",         "Sports");     gen(m,"I",2013,2020,"RWD"); }
{ const m = model(14, "Junior",     "Crossover");  gen(m,"I",2024,null,"FWD/AWD"); }

// ── Volvo (15) ─────────────────────────────────────────────────────────────────
{ const m = model(15, "V40",        "Hatchback"); gen(m,"II",2012,2019,"FWD/AWD"); }
{ const m = model(15, "V60",        "Estate");    gen(m,"I",2010,2018,"FWD/AWD"); gen(m,"II",2018,null,"FWD/AWD"); }
{ const m = model(15, "V90",        "Estate");    gen(m,"II",2016,null,"FWD/AWD"); }
{ const m = model(15, "XC40",       "Crossover"); gen(m,"I",2017,null,"FWD/AWD"); }
{ const m = model(15, "XC60",       "SUV");       gen(m,"I",2008,2017,"FWD/AWD"); gen(m,"II",2017,null,"FWD/AWD"); }
{ const m = model(15, "XC90",       "SUV");       gen(m,"II",2014,null,"AWD"); }
{ const m = model(15, "S60",        "Sedan");     gen(m,"II",2010,2018,"FWD/AWD"); gen(m,"III",2018,null,"FWD/AWD"); }
{ const m = model(15, "S90",        "Sedan");     gen(m,"II",2016,null,"FWD/AWD"); }
{ const m = model(15, "C30",        "Hatchback"); gen(m,"I",2006,2013,"FWD"); }
{ const m = model(15, "C40",        "Crossover"); gen(m,"I",2021,null,"FWD/AWD"); }
{ const m = model(15, "V70",        "Estate");    gen(m,"III",2007,2016,"FWD/AWD"); }
{ const m = model(15, "S80",        "Sedan");     gen(m,"II",2006,2016,"FWD/AWD"); }
{ const m = model(15, "S40",        "Sedan");     gen(m,"II",2004,2012,"FWD/AWD"); }
{ const m = model(15, "V50",        "Estate");    gen(m,"I",2004,2012,"FWD/AWD"); }
{ const m = model(15, "EX30",       "Crossover"); gen(m,"I",2023,null,"RWD/AWD"); }
{ const m = model(15, "EX40",       "Crossover"); gen(m,"I",2023,null,"RWD/AWD"); }
{ const m = model(15, "EX90",       "SUV");       gen(m,"I",2024,null,"AWD"); }

// ── Mini (16) ──────────────────────────────────────────────────────────────────
{ const m = model(16, "Cooper",      "Hatchback");   gen(m,"R56",2006,2013,"FWD"); gen(m,"F56",2014,null,"FWD/AWD"); }
{ const m = model(16, "Countryman",  "Crossover");   gen(m,"R60",2010,2016,"FWD/AWD"); gen(m,"F60",2017,2023,"FWD/AWD"); gen(m,"U25",2023,null,"FWD/AWD"); }
{ const m = model(16, "Clubman",     "Estate");      gen(m,"R55",2007,2014,"FWD"); gen(m,"F54",2015,null,"FWD/AWD"); }
{ const m = model(16, "Paceman",     "Crossover");   gen(m,"R61",2012,2016,"FWD/AWD"); }
{ const m = model(16, "Convertible", "Convertible"); gen(m,"R57",2008,2015,"FWD"); gen(m,"F57",2015,null,"FWD/AWD"); }
{ const m = model(16, "Coupe",       "Coupe");       gen(m,"R58",2011,2015,"FWD"); }
{ const m = model(16, "Roadster",    "Sports");      gen(m,"R59",2012,2015,"RWD"); }
{ const m = model(16, "Hatch 5dr",   "Hatchback");   gen(m,"F55",2014,null,"FWD/AWD"); }
{ const m = model(16, "Aceman",      "Crossover");   gen(m,"J05",2024,null,"FWD/AWD"); }

// ── Porsche (17) ───────────────────────────────────────────────────────────────
{ const m = model(17, "911",         "Sports");  gen(m,"997",2004,2012,"RWD/AWD"); gen(m,"991",2011,2019,"RWD/AWD"); gen(m,"992",2018,null,"RWD/AWD"); }
{ const m = model(17, "Cayenne",     "SUV");     gen(m,"9PA",2002,2010,"AWD"); gen(m,"92A",2010,2017,"AWD"); gen(m,"9YA",2017,null,"AWD"); }
{ const m = model(17, "Macan",       "SUV");     gen(m,"95B",2014,2024,"AWD"); gen(m,"J1",2024,null,"AWD"); }
{ const m = model(17, "Panamera",    "Luxury");  gen(m,"970",2009,2016,"RWD/AWD"); gen(m,"971",2016,null,"RWD/AWD"); }
{ const m = model(17, "Boxster",     "Sports");  gen(m,"987",2004,2012,"RWD"); gen(m,"981",2012,2016,"RWD"); gen(m,"718",2016,null,"RWD"); }
{ const m = model(17, "Cayman",      "Sports");  gen(m,"987C",2005,2012,"RWD"); gen(m,"981C",2012,2016,"RWD"); gen(m,"718C",2016,null,"RWD"); }
{ const m = model(17, "Taycan",      "Sedan");   gen(m,"I",2019,null,"RWD/AWD"); }
{ const m = model(17, "Cayenne Coupe","SUV");    gen(m,"9YB",2019,null,"AWD"); }

// ── Land Rover (18) ────────────────────────────────────────────────────────────
{ const m = model(18, "Defender",          "SUV");       gen(m,"L316",2000,2016,"4WD"); gen(m,"L663",2020,null,"4WD"); }
{ const m = model(18, "Discovery",         "SUV");       gen(m,"L319",2004,2017,"4WD"); gen(m,"L462",2017,null,"4WD"); }
{ const m = model(18, "Range Rover",       "SUV");       gen(m,"L322",2002,2012,"4WD"); gen(m,"L405",2012,2021,"4WD"); gen(m,"L460",2021,null,"4WD"); }
{ const m = model(18, "Freelander",        "SUV");       gen(m,"L359",2006,2015,"FWD/AWD"); }
{ const m = model(18, "Discovery Sport",   "SUV");       gen(m,"L550",2014,null,"FWD/AWD"); }
{ const m = model(18, "Range Rover Sport", "SUV");       gen(m,"L320",2005,2013,"4WD"); gen(m,"L494",2013,2022,"4WD"); gen(m,"L461",2022,null,"4WD"); }
{ const m = model(18, "Evoque",            "Crossover"); gen(m,"L538",2011,2018,"FWD/AWD"); gen(m,"L551",2019,null,"FWD/AWD"); }
{ const m = model(18, "Velar",             "SUV");       gen(m,"L560",2017,null,"FWD/AWD"); }

// ── Jaguar (19) ────────────────────────────────────────────────────────────────
{ const m = model(19, "XE",    "Sedan");     gen(m,"X760",2015,null,"RWD/AWD"); }
{ const m = model(19, "XF",    "Sedan");     gen(m,"X250",2007,2015,"RWD/AWD"); gen(m,"X260",2015,null,"RWD/AWD"); }
{ const m = model(19, "F-Pace","SUV");       gen(m,"X761",2016,null,"RWD/AWD"); }
{ const m = model(19, "E-Pace","Crossover"); gen(m,"X540",2017,null,"FWD/AWD"); }
{ const m = model(19, "I-Pace","SUV");       gen(m,"X590",2018,null,"AWD"); }
{ const m = model(19, "F-Type","Sports");    gen(m,"X152",2013,null,"RWD/AWD"); }
{ const m = model(19, "XJ",    "Luxury");    gen(m,"X351",2009,2019,"RWD/AWD"); }

// ── Smart (20) ─────────────────────────────────────────────────────────────────
{ const m = model(20, "ForTwo",    "Supermini"); gen(m,"W450",2000,2007,"RWD"); gen(m,"W451",2007,2014,"RWD"); gen(m,"W453",2014,null,"RWD/FWD"); }
{ const m = model(20, "ForFour",   "Supermini"); gen(m,"W454",2004,2006,"RWD"); gen(m,"W453F",2014,null,"RWD/FWD"); }
{ const m = model(20, "Smart #1",  "Crossover"); gen(m,"HX11",2022,null,"RWD/AWD"); }
{ const m = model(20, "Smart #3",  "Crossover"); gen(m,"HX12",2023,null,"RWD/AWD"); }

// ── DS Automobiles (21) ────────────────────────────────────────────────────────
{ const m = model(21, "DS3",       "Supermini"); gen(m,"I",2010,2019,"FWD"); gen(m,"II",2019,null,"FWD/AWD"); }
{ const m = model(21, "DS4",       "Hatchback"); gen(m,"I",2010,2015,"FWD"); gen(m,"II",2021,null,"FWD/AWD"); }
{ const m = model(21, "DS5",       "Hatchback"); gen(m,"I",2011,2018,"FWD/AWD"); }
{ const m = model(21, "DS7",       "SUV");       gen(m,"I",2017,null,"FWD/AWD"); }
{ const m = model(21, "DS9",       "Sedan");     gen(m,"I",2021,null,"FWD/AWD"); }

// ── Cupra (22) ─────────────────────────────────────────────────────────────────
{ const m = model(22, "Formentor", "Crossover"); gen(m,"I",2020,null,"FWD/AWD"); }
{ const m = model(22, "Born",      "Hatchback"); gen(m,"I",2021,null,"RWD"); }
{ const m = model(22, "Ateca",     "SUV");       gen(m,"I",2018,null,"FWD/AWD"); }
{ const m = model(22, "Leon",      "Hatchback"); gen(m,"I",2021,null,"FWD/AWD"); }
{ const m = model(22, "Terramar",  "SUV");       gen(m,"I",2024,null,"FWD/AWD"); }
{ const m = model(22, "Tavascan",  "Crossover"); gen(m,"I",2024,null,"RWD/AWD"); }

// ── Saab (23) ──────────────────────────────────────────────────────────────────
{ const m = model(23, "9-3",       "Sedan");     gen(m,"II",2002,2011,"FWD"); }
{ const m = model(23, "9-5",       "Sedan");     gen(m,"II",2010,2011,"FWD/AWD"); }

// ── Lancia (24) ────────────────────────────────────────────────────────────────
{ const m = model(24, "Ypsilon",   "Supermini"); gen(m,"II",2003,2011,"FWD"); gen(m,"III",2011,null,"FWD"); }
{ const m = model(24, "Delta",     "Hatchback"); gen(m,"III",2008,2014,"FWD"); }
{ const m = model(24, "Musa",      "MPV");       gen(m,"I",2004,2012,"FWD"); }

// ── Ferrari (25) ───────────────────────────────────────────────────────────────
{ const m = model(25, "458 Italia",    "Supercar"); gen(m,"I",2009,2015,"RWD"); }
{ const m = model(25, "488",           "Supercar"); gen(m,"I",2015,2019,"RWD"); }
{ const m = model(25, "F8 Tributo",    "Supercar"); gen(m,"I",2019,null,"RWD"); }
{ const m = model(25, "Roma",          "Sports");   gen(m,"I",2020,null,"RWD"); }
{ const m = model(25, "California",    "Convertible");gen(m,"I",2008,2017,"RWD"); }
{ const m = model(25, "296 GTB",       "Supercar"); gen(m,"I",2021,null,"RWD"); }
{ const m = model(25, "SF90 Stradale", "Supercar"); gen(m,"I",2019,null,"AWD"); }
{ const m = model(25, "Purosangue",    "SUV");      gen(m,"I",2022,null,"AWD"); }
{ const m = model(25, "Portofino",     "Convertible");gen(m,"I",2017,null,"RWD"); }
{ const m = model(25, "812 Superfast", "Supercar"); gen(m,"I",2017,null,"RWD"); }

// ── Lamborghini (26) ───────────────────────────────────────────────────────────
{ const m = model(26, "Gallardo",  "Supercar"); gen(m,"I",2003,2013,"AWD"); }
{ const m = model(26, "Huracan",   "Supercar"); gen(m,"I",2014,null,"AWD"); }
{ const m = model(26, "Aventador", "Supercar"); gen(m,"I",2011,2022,"AWD"); }
{ const m = model(26, "Urus",      "SUV");      gen(m,"I",2018,null,"AWD"); }
{ const m = model(26, "Revuelto",  "Supercar"); gen(m,"I",2023,null,"AWD"); }

// ── Maserati (27) ──────────────────────────────────────────────────────────────
{ const m = model(27, "Ghibli",        "Sedan");  gen(m,"III",2013,2022,"RWD/AWD"); }
{ const m = model(27, "Quattroporte",  "Luxury");  gen(m,"VI",2013,2022,"RWD/AWD"); }
{ const m = model(27, "Levante",       "SUV");     gen(m,"I",2016,null,"RWD/AWD"); }
{ const m = model(27, "GranTurismo",   "Coupe");   gen(m,"I",2007,2019,"RWD"); gen(m,"II",2022,null,"AWD"); }
{ const m = model(27, "Grecale",       "SUV");     gen(m,"I",2022,null,"RWD/AWD"); }

// ── Bentley (28) ───────────────────────────────────────────────────────────────
{ const m = model(28, "Continental GT", "Luxury"); gen(m,"II",2011,2017,"AWD"); gen(m,"III",2017,null,"AWD"); }
{ const m = model(28, "Flying Spur",    "Luxury"); gen(m,"II",2013,2019,"AWD"); gen(m,"III",2019,null,"AWD"); }
{ const m = model(28, "Bentayga",       "SUV");    gen(m,"I",2015,2020,"AWD"); gen(m,"II",2020,null,"AWD"); }
{ const m = model(28, "Mulsanne",       "Luxury"); gen(m,"III",2010,2020,"RWD"); }

// ── Rolls-Royce (29) ───────────────────────────────────────────────────────────
{ const m = model(29, "Ghost",   "Luxury"); gen(m,"I",2009,2020,"RWD"); gen(m,"II",2020,null,"AWD"); }
{ const m = model(29, "Phantom", "Luxury"); gen(m,"VII",2003,2017,"RWD"); gen(m,"VIII",2017,null,"RWD"); }
{ const m = model(29, "Wraith",  "Coupe");  gen(m,"I",2013,2023,"RWD"); }
{ const m = model(29, "Cullinan","SUV");    gen(m,"I",2018,null,"AWD"); }
{ const m = model(29, "Spectre", "Coupe");  gen(m,"I",2023,null,"AWD"); }
{ const m = model(29, "Dawn",    "Convertible");gen(m,"I",2015,2023,"RWD"); }

// ── Aston Martin (30) ──────────────────────────────────────────────────────────
{ const m = model(30, "DB9",     "Coupe");  gen(m,"I",2003,2016,"RWD"); }
{ const m = model(30, "DB11",    "Coupe");  gen(m,"I",2016,null,"RWD/AWD"); }
{ const m = model(30, "Vantage", "Sports"); gen(m,"II",2005,2018,"RWD"); gen(m,"III",2018,null,"RWD"); }
{ const m = model(30, "DBS",     "Coupe");  gen(m,"II",2007,2012,"RWD"); gen(m,"III",2018,null,"RWD"); }
{ const m = model(30, "Rapide",  "Sedan");  gen(m,"I",2010,2020,"RWD"); }
{ const m = model(30, "DBX",     "SUV");    gen(m,"I",2020,null,"AWD"); }

// ── McLaren (31) ───────────────────────────────────────────────────────────────
{ const m = model(31, "720S",   "Supercar"); gen(m,"I",2017,null,"RWD"); }
{ const m = model(31, "570S",   "Sports");   gen(m,"I",2015,2021,"RWD"); }
{ const m = model(31, "GT",     "Sports");   gen(m,"I",2019,null,"RWD"); }
{ const m = model(31, "Artura", "Sports");   gen(m,"I",2021,null,"RWD"); }
{ const m = model(31, "750S",   "Supercar"); gen(m,"I",2023,null,"RWD"); }

// ── Lotus (32) ─────────────────────────────────────────────────────────────────
{ const m = model(32, "Elise",  "Sports"); gen(m,"S3",2010,2021,"RWD"); }
{ const m = model(32, "Evora",  "Sports"); gen(m,"I",2009,2021,"RWD"); }
{ const m = model(32, "Exige",  "Sports"); gen(m,"S3",2011,2021,"RWD"); }
{ const m = model(32, "Emira",  "Sports"); gen(m,"I",2021,null,"RWD"); }
{ const m = model(32, "Eletre", "SUV");    gen(m,"I",2023,null,"AWD"); }

// ── Polestar (33) ──────────────────────────────────────────────────────────────
{ const m = model(33, "Polestar 2", "Sedan");     gen(m,"I",2020,null,"RWD/AWD"); }
{ const m = model(33, "Polestar 3", "SUV");       gen(m,"I",2022,null,"AWD"); }
{ const m = model(33, "Polestar 4", "Crossover"); gen(m,"I",2023,null,"AWD"); }

// ── MG (34) ────────────────────────────────────────────────────────────────────
{ const m = model(34, "MG3",       "Supermini"); gen(m,"I",2013,null,"FWD"); }
{ const m = model(34, "MG5",       "Estate");    gen(m,"I",2019,null,"FWD"); }
{ const m = model(34, "MG ZS",     "Crossover"); gen(m,"I",2017,null,"FWD/AWD"); }
{ const m = model(34, "MG HS",     "SUV");       gen(m,"I",2018,null,"FWD"); }
{ const m = model(34, "MG4",       "Hatchback"); gen(m,"I",2022,null,"RWD/AWD"); }
{ const m = model(34, "MG Cyberster","Convertible");gen(m,"I",2023,null,"RWD/AWD"); }
{ const m = model(34, "MG EHS",    "SUV");       gen(m,"I",2020,null,"FWD/AWD"); }

// ── Daewoo (35) ────────────────────────────────────────────────────────────────
{ const m = model(35, "Matiz",  "Supermini"); gen(m,"I",1998,2005,"FWD"); }
{ const m = model(35, "Kalos",  "Supermini"); gen(m,"I",2002,2008,"FWD"); }
{ const m = model(35, "Lacetti","Hatchback"); gen(m,"I",2002,2008,"FWD"); }
{ const m = model(35, "Nubira", "Sedan");     gen(m,"II",2002,2004,"FWD"); }

// ── Rover (36) ─────────────────────────────────────────────────────────────────
{ const m = model(36, "75", "Sedan");     gen(m,"I",1999,2005,"RWD"); }
{ const m = model(36, "45", "Sedan");     gen(m,"I",1999,2005,"FWD"); }
{ const m = model(36, "25", "Hatchback"); gen(m,"I",1999,2005,"FWD"); }

// ── Toyota (37) ────────────────────────────────────────────────────────────────
{ const m = model(37, "Corolla",      "Hatchback"); gen(m,"E150",2006,2013,"FWD"); gen(m,"E180",2012,2018,"FWD"); gen(m,"E210",2018,null,"FWD/AWD"); }
{ const m = model(37, "Yaris",        "Supermini"); gen(m,"XP90",2005,2011,"FWD"); gen(m,"XP130",2011,2020,"FWD"); gen(m,"XP210",2020,null,"FWD/AWD"); }
{ const m = model(37, "RAV4",         "SUV");       gen(m,"XA30",2005,2012,"FWD/AWD"); gen(m,"XA40",2012,2018,"FWD/AWD"); gen(m,"XA50",2018,null,"FWD/AWD"); }
{ const m = model(37, "Camry",        "Sedan");     gen(m,"XV40",2006,2011,"FWD"); gen(m,"XV50",2011,2017,"FWD"); gen(m,"XV70",2017,null,"FWD"); }
{ const m = model(37, "Land Cruiser", "SUV");       gen(m,"J200",2007,2021,"4WD"); gen(m,"J300",2021,null,"4WD"); }
{ const m = model(37, "Auris",        "Hatchback"); gen(m,"E150",2006,2012,"FWD"); gen(m,"E180",2012,2018,"FWD"); }
{ const m = model(37, "C-HR",         "Crossover"); gen(m,"I",2016,2023,"FWD/AWD"); gen(m,"II",2023,null,"FWD/AWD"); }
{ const m = model(37, "Prius",        "Hatchback"); gen(m,"XW30",2009,2015,"FWD"); gen(m,"XW50",2015,2022,"FWD/AWD"); gen(m,"XW60",2022,null,"FWD/AWD"); }
{ const m = model(37, "Hilux",        "Pickup");    gen(m,"AN120",2015,null,"RWD/4WD"); }
{ const m = model(37, "Supra",        "Coupe");     gen(m,"A90",2019,null,"RWD"); }
{ const m = model(37, "Aygo",         "Supermini"); gen(m,"I",2005,2014,"FWD"); gen(m,"II",2014,2021,"FWD"); }
{ const m = model(37, "Avensis",      "Sedan");     gen(m,"III",2008,2018,"FWD"); }
{ const m = model(37, "bZ4X",         "SUV");       gen(m,"I",2022,null,"FWD/AWD"); }
{ const m = model(37, "Verso",        "MPV");       gen(m,"I",2009,2018,"FWD"); }
{ const m = model(37, "Aygo X",       "Crossover"); gen(m,"I",2021,null,"FWD"); }
{ const m = model(37, "GR Yaris",     "Hatchback"); gen(m,"I",2020,null,"AWD"); }
{ const m = model(37, "Proace City",  "MPV");       gen(m,"I",2019,null,"FWD"); }

// ── Honda (38) ─────────────────────────────────────────────────────────────────
{ const m = model(38, "Civic",    "Hatchback"); gen(m,"VIII",2005,2011,"FWD"); gen(m,"IX",2011,2015,"FWD"); gen(m,"X",2015,2021,"FWD"); gen(m,"XI",2021,null,"FWD"); }
{ const m = model(38, "CR-V",     "SUV");       gen(m,"III",2006,2011,"FWD/AWD"); gen(m,"IV",2012,2016,"FWD/AWD"); gen(m,"V",2017,2022,"FWD/AWD"); gen(m,"VI",2022,null,"FWD/AWD"); }
{ const m = model(38, "Jazz",     "Hatchback"); gen(m,"III",2008,2014,"FWD"); gen(m,"IV",2014,2020,"FWD"); gen(m,"V",2020,null,"FWD"); }
{ const m = model(38, "Accord",   "Sedan");     gen(m,"VIII",2008,2012,"FWD"); gen(m,"IX",2012,2017,"FWD"); }
{ const m = model(38, "HR-V",     "Crossover"); gen(m,"II",2015,2021,"FWD/AWD"); gen(m,"III",2021,null,"FWD/AWD"); }
{ const m = model(38, "FR-V",     "MPV");       gen(m,"I",2004,2009,"FWD"); }
{ const m = model(38, "Stream",   "MPV");       gen(m,"II",2006,2014,"FWD"); }
{ const m = model(38, "Honda e",  "Hatchback"); gen(m,"I",2019,2023,"RWD"); }
{ const m = model(38, "ZR-V",     "Crossover"); gen(m,"I",2022,null,"FWD/AWD"); }
{ const m = model(38, "Legend",   "Luxury");    gen(m,"IV",2004,2012,"AWD"); }
{ const m = model(38, "Insight",  "Hatchback"); gen(m,"III",2018,2022,"FWD"); }
{ const m = model(38, "e:Ny1",    "Crossover"); gen(m,"I",2023,null,"FWD"); }

// ── Hyundai (39) ───────────────────────────────────────────────────────────────
{ const m = model(39, "i20",       "Supermini"); gen(m,"I",2008,2014,"FWD"); gen(m,"II",2014,2020,"FWD"); gen(m,"III",2020,null,"FWD"); }
{ const m = model(39, "i30",       "Hatchback"); gen(m,"I",2007,2011,"FWD"); gen(m,"II",2011,2017,"FWD"); gen(m,"III",2017,null,"FWD"); }
{ const m = model(39, "i40",       "Sedan");     gen(m,"I",2011,2019,"FWD"); }
{ const m = model(39, "Tucson",    "SUV");       gen(m,"II",2009,2015,"FWD/AWD"); gen(m,"III",2015,2020,"FWD/AWD"); gen(m,"IV",2020,null,"FWD/AWD"); }
{ const m = model(39, "Santa Fe",  "SUV");       gen(m,"II",2006,2012,"FWD/AWD"); gen(m,"III",2012,2018,"FWD/AWD"); gen(m,"IV",2018,null,"FWD/AWD"); }
{ const m = model(39, "Sonata",    "Sedan");     gen(m,"NF",2004,2010,"FWD"); gen(m,"YF",2010,2014,"FWD"); gen(m,"LF",2014,2019,"FWD"); gen(m,"DN8",2019,null,"FWD"); }
{ const m = model(39, "Accent",    "Sedan");     gen(m,"RB",2010,2017,"FWD"); gen(m,"HC",2017,null,"FWD"); }
{ const m = model(39, "Ioniq",     "Hatchback"); gen(m,"I",2016,2022,"FWD"); }
{ const m = model(39, "Kona",      "Crossover"); gen(m,"I",2017,2023,"FWD/AWD"); gen(m,"II",2023,null,"FWD/AWD"); }
{ const m = model(39, "Ioniq 5",   "Crossover"); gen(m,"I",2021,null,"RWD/AWD"); }
{ const m = model(39, "Ioniq 6",   "Sedan");     gen(m,"I",2022,null,"RWD/AWD"); }
{ const m = model(39, "Bayon",     "Crossover"); gen(m,"I",2021,null,"FWD"); }
{ const m = model(39, "ix20",      "Hatchback"); gen(m,"I",2010,2019,"FWD"); }
{ const m = model(39, "Veloster",  "Hatchback"); gen(m,"I",2011,2017,"FWD"); gen(m,"II",2018,2022,"FWD"); }
{ const m = model(39, "NEXO",      "SUV");       gen(m,"I",2018,null,"FWD"); }
{ const m = model(39, "Ioniq 9",   "SUV");       gen(m,"I",2025,null,"RWD/AWD"); }
{ const m = model(39, "ix35",      "Crossover"); gen(m,"I",2009,2015,"FWD/AWD"); }
{ const m = model(39, "i10",       "Supermini"); gen(m,"I",2007,2013,"FWD"); gen(m,"II",2013,2019,"FWD"); gen(m,"III",2019,null,"FWD"); }

// ── Kia (40) ───────────────────────────────────────────────────────────────────
{ const m = model(40, "Ceed",      "Hatchback"); gen(m,"I",2006,2012,"FWD"); gen(m,"II",2012,2018,"FWD"); gen(m,"III",2018,null,"FWD"); }
{ const m = model(40, "Sportage",  "SUV");       gen(m,"III",2010,2015,"FWD/AWD"); gen(m,"IV",2015,2021,"FWD/AWD"); gen(m,"V",2021,null,"FWD/AWD"); }
{ const m = model(40, "Sorento",   "SUV");       gen(m,"II",2009,2014,"FWD/AWD"); gen(m,"III",2014,2020,"FWD/AWD"); gen(m,"IV",2020,null,"FWD/AWD"); }
{ const m = model(40, "Rio",       "Supermini"); gen(m,"III",2011,2017,"FWD"); gen(m,"IV",2017,null,"FWD"); }
{ const m = model(40, "Stinger",   "Sedan");     gen(m,"I",2017,null,"RWD/AWD"); }
{ const m = model(40, "Niro",      "Crossover"); gen(m,"I",2016,2022,"FWD"); gen(m,"II",2022,null,"FWD"); }
{ const m = model(40, "Soul",      "Crossover"); gen(m,"I",2008,2014,"FWD"); gen(m,"II",2013,2019,"FWD"); gen(m,"III",2019,null,"FWD"); }
{ const m = model(40, "EV6",       "Crossover"); gen(m,"I",2021,null,"RWD/AWD"); }
{ const m = model(40, "Picanto",   "Supermini"); gen(m,"I",2004,2011,"FWD"); gen(m,"II",2011,2017,"FWD"); gen(m,"III",2017,null,"FWD"); }
{ const m = model(40, "Stonic",    "Crossover"); gen(m,"I",2017,null,"FWD"); }
{ const m = model(40, "Xceed",     "Crossover"); gen(m,"I",2019,null,"FWD"); }
{ const m = model(40, "EV9",       "SUV");       gen(m,"I",2023,null,"RWD/AWD"); }
{ const m = model(40, "ProCeed",   "Estate");    gen(m,"I",2018,null,"FWD"); }
{ const m = model(40, "Carens",    "MPV");       gen(m,"III",2013,2019,"FWD"); gen(m,"IV",2022,null,"FWD"); }
{ const m = model(40, "Venga",     "MPV");       gen(m,"I",2009,2019,"FWD"); }

// ── Nissan (41) ────────────────────────────────────────────────────────────────
{ const m = model(41, "Micra",     "Supermini"); gen(m,"K12",2002,2010,"FWD"); gen(m,"K13",2010,2017,"FWD"); gen(m,"K14",2017,null,"FWD"); }
{ const m = model(41, "Note",      "Hatchback"); gen(m,"E11",2005,2013,"FWD"); gen(m,"E12",2012,2020,"FWD"); }
{ const m = model(41, "Juke",      "Crossover"); gen(m,"F15",2010,2019,"FWD/AWD"); gen(m,"F16",2019,null,"FWD/AWD"); }
{ const m = model(41, "Qashqai",   "SUV");       gen(m,"J10",2006,2013,"FWD/AWD"); gen(m,"J11",2013,2021,"FWD/AWD"); gen(m,"J12",2021,null,"FWD/AWD"); }
{ const m = model(41, "X-Trail",   "SUV");       gen(m,"T31",2007,2014,"FWD/AWD"); gen(m,"T32",2013,2021,"FWD/AWD"); gen(m,"T33",2021,null,"FWD/AWD"); }
{ const m = model(41, "Leaf",      "Hatchback"); gen(m,"ZE0",2010,2017,"FWD"); gen(m,"ZE1",2017,null,"FWD"); }
{ const m = model(41, "Navara",    "Pickup");    gen(m,"D40",2004,2015,"RWD/4WD"); gen(m,"D23",2015,null,"RWD/4WD"); }
{ const m = model(41, "370Z",      "Coupe");     gen(m,"Z34",2009,2020,"RWD"); }
{ const m = model(41, "Ariya",     "Crossover"); gen(m,"I",2021,null,"FWD/AWD"); }
{ const m = model(41, "GT-R",      "Supercar");  gen(m,"R35",2007,null,"AWD"); }
{ const m = model(41, "Murano",    "SUV");       gen(m,"Z51",2008,2014,"AWD"); gen(m,"Z52",2014,null,"FWD/AWD"); }
{ const m = model(41, "Pulsar",    "Hatchback"); gen(m,"C13",2014,2018,"FWD"); }

// ── Mazda (42) ─────────────────────────────────────────────────────────────────
{ const m = model(42, "Mazda2",    "Supermini"); gen(m,"DE",2007,2014,"FWD"); gen(m,"DJ",2014,null,"FWD"); }
{ const m = model(42, "Mazda3",    "Hatchback"); gen(m,"BL",2008,2013,"FWD"); gen(m,"BM",2013,2018,"FWD"); gen(m,"BP",2018,null,"FWD/AWD"); }
{ const m = model(42, "Mazda6",    "Sedan");     gen(m,"GH",2007,2012,"FWD"); gen(m,"GJ",2012,null,"FWD"); }
{ const m = model(42, "CX-3",      "Crossover"); gen(m,"DK",2015,null,"FWD/AWD"); }
{ const m = model(42, "CX-5",      "SUV");       gen(m,"KE",2012,2017,"FWD/AWD"); gen(m,"KF",2017,null,"FWD/AWD"); }
{ const m = model(42, "CX-30",     "Crossover"); gen(m,"DM",2019,null,"FWD/AWD"); }
{ const m = model(42, "MX-5",      "Sports");    gen(m,"NC",2005,2014,"RWD"); gen(m,"ND",2015,null,"RWD"); }
{ const m = model(42, "CX-60",     "SUV");       gen(m,"KH",2022,null,"FWD/AWD"); }
{ const m = model(42, "MX-30",     "Crossover"); gen(m,"DR",2020,null,"FWD"); }
{ const m = model(42, "CX-9",      "SUV");       gen(m,"TC",2016,null,"AWD"); }
{ const m = model(42, "RX-8",      "Coupe");     gen(m,"SE3P",2002,2012,"RWD"); }

// ── Mitsubishi (43) ────────────────────────────────────────────────────────────
{ const m = model(43, "Outlander",     "SUV");       gen(m,"II",2005,2012,"FWD/AWD"); gen(m,"III",2012,2021,"FWD/AWD"); gen(m,"IV",2021,null,"FWD/AWD"); }
{ const m = model(43, "ASX",           "Crossover"); gen(m,"I",2010,null,"FWD/AWD"); }
{ const m = model(43, "Eclipse Cross", "Crossover"); gen(m,"I",2017,null,"FWD/AWD"); }
{ const m = model(43, "L200",          "Pickup");    gen(m,"IV",2005,2014,"4WD"); gen(m,"V",2014,null,"4WD"); }
{ const m = model(43, "Colt",          "Hatchback"); gen(m,"VI",2004,2012,"FWD"); }
{ const m = model(43, "Galant",        "Sedan");     gen(m,"IX",2003,2012,"FWD"); }
{ const m = model(43, "Grandis",       "MPV");       gen(m,"I",2003,2011,"FWD"); }
{ const m = model(43, "Pajero",        "SUV");       gen(m,"V80",2006,2021,"4WD"); }
{ const m = model(43, "Space Star",    "Supermini"); gen(m,"I",2012,null,"FWD"); }
{ const m = model(43, "i-MiEV",        "Hatchback"); gen(m,"I",2009,2021,"FWD"); }

// ── Suzuki (44) ────────────────────────────────────────────────────────────────
{ const m = model(44, "Swift",         "Supermini"); gen(m,"II",2004,2010,"FWD"); gen(m,"III",2010,2017,"FWD/AWD"); gen(m,"IV",2017,null,"FWD"); }
{ const m = model(44, "Vitara",        "Crossover"); gen(m,"LY",2015,null,"FWD/AWD"); }
{ const m = model(44, "SX4",           "Hatchback"); gen(m,"I",2006,2013,"FWD/AWD"); }
{ const m = model(44, "Grand Vitara",  "SUV");       gen(m,"II",2005,2015,"FWD/AWD"); }
{ const m = model(44, "Jimny",         "SUV");       gen(m,"III",1998,2018,"4WD"); gen(m,"IV",2018,null,"4WD"); }
{ const m = model(44, "S-Cross",       "Crossover"); gen(m,"I",2013,2021,"FWD/AWD"); gen(m,"II",2021,null,"FWD/AWD"); }
{ const m = model(44, "Ignis",         "Supermini"); gen(m,"I",2016,null,"FWD/AWD"); }
{ const m = model(44, "Baleno",        "Hatchback"); gen(m,"II",2015,2022,"FWD"); gen(m,"III",2022,null,"FWD"); }
{ const m = model(44, "Celerio",       "Supermini"); gen(m,"I",2014,null,"FWD"); }
{ const m = model(44, "Across",        "SUV");       gen(m,"I",2020,null,"FWD/AWD"); }
{ const m = model(44, "Swace",         "Estate");    gen(m,"I",2020,null,"FWD"); }
{ const m = model(44, "SX4 S-Cross",   "Crossover"); gen(m,"I",2013,2021,"FWD/AWD"); }

// ── Subaru (45) ────────────────────────────────────────────────────────────────
{ const m = model(45, "Impreza",  "Sedan");     gen(m,"GD/GG",2000,2007,"AWD"); gen(m,"GE/GH",2007,2011,"AWD"); gen(m,"GP/GJ",2011,2016,"AWD"); gen(m,"GK/GT",2016,null,"AWD"); }
{ const m = model(45, "Legacy",   "Sedan");     gen(m,"BL/BP",2003,2009,"AWD"); gen(m,"BM/BR",2009,2014,"AWD"); gen(m,"BS/BN",2014,null,"AWD"); }
{ const m = model(45, "Forester", "SUV");       gen(m,"SG",2002,2008,"AWD"); gen(m,"SH",2008,2012,"AWD"); gen(m,"SJ",2012,2018,"AWD"); gen(m,"SK",2018,null,"AWD"); }
{ const m = model(45, "Outback",  "Estate");    gen(m,"BP",2003,2009,"AWD"); gen(m,"BR",2009,2014,"AWD"); gen(m,"BS",2014,2020,"AWD"); gen(m,"BT",2020,null,"AWD"); }
{ const m = model(45, "XV",       "Crossover"); gen(m,"GP",2012,2017,"AWD"); gen(m,"GT",2017,2022,"AWD"); gen(m,"GU",2022,null,"AWD"); }
{ const m = model(45, "BRZ",      "Coupe");     gen(m,"ZC6",2012,2020,"RWD"); gen(m,"ZD8",2021,null,"RWD"); }
{ const m = model(45, "WRX",      "Sedan");     gen(m,"VA",2014,2021,"AWD"); gen(m,"VB",2021,null,"AWD"); }
{ const m = model(45, "Levorg",   "Estate");    gen(m,"VM",2014,2020,"AWD"); gen(m,"VN",2020,null,"AWD"); }
{ const m = model(45, "Solterra", "SUV");       gen(m,"I",2022,null,"AWD"); }

// ── Lexus (46) ─────────────────────────────────────────────────────────────────
{ const m = model(46, "IS",        "Sedan");     gen(m,"XE20",2005,2013,"RWD/AWD"); gen(m,"XE30",2013,null,"RWD/AWD"); }
{ const m = model(46, "ES",        "Sedan");     gen(m,"XV60",2012,2018,"FWD"); gen(m,"XV70",2018,null,"FWD"); }
{ const m = model(46, "RX",        "SUV");       gen(m,"XU30",2003,2009,"FWD/AWD"); gen(m,"XU40",2009,2015,"FWD/AWD"); gen(m,"XU50",2015,2022,"FWD/AWD"); gen(m,"XU80",2022,null,"FWD/AWD"); }
{ const m = model(46, "NX",        "Crossover"); gen(m,"AZ10",2014,2021,"FWD/AWD"); gen(m,"AZ20",2021,null,"FWD/AWD"); }
{ const m = model(46, "UX",        "Crossover"); gen(m,"ZA10",2018,null,"FWD/AWD"); }
{ const m = model(46, "LS",        "Luxury");    gen(m,"F40",2006,2017,"RWD/AWD"); gen(m,"F50",2017,null,"RWD/AWD"); }
{ const m = model(46, "GS",        "Sedan");     gen(m,"L10",2005,2011,"RWD/AWD"); gen(m,"L10FL",2012,2020,"RWD/AWD"); }
{ const m = model(46, "CT",        "Hatchback"); gen(m,"ZWA10",2010,2022,"FWD"); }
{ const m = model(46, "LC",        "Coupe");     gen(m,"Z100",2017,null,"RWD/AWD"); }
{ const m = model(46, "RC",        "Coupe");     gen(m,"XC10",2014,null,"RWD/AWD"); }
{ const m = model(46, "RZ",        "SUV");       gen(m,"XJ20",2022,null,"AWD"); }
{ const m = model(46, "LX",        "SUV");       gen(m,"J200",2007,2021,"4WD"); gen(m,"J300",2021,null,"4WD"); }

// ── Jeep (47) ──────────────────────────────────────────────────────────────────
{ const m = model(47, "Cherokee",       "SUV");       gen(m,"KL",2013,null,"FWD/AWD"); }
{ const m = model(47, "Grand Cherokee", "SUV");       gen(m,"WK",2004,2010,"4WD"); gen(m,"WK2",2010,2021,"4WD"); gen(m,"WL",2021,null,"4WD"); }
{ const m = model(47, "Renegade",       "Crossover"); gen(m,"BU",2014,null,"FWD/AWD"); }
{ const m = model(47, "Compass",        "Crossover"); gen(m,"MK49",2006,2010,"FWD/AWD"); gen(m,"M6",2017,null,"FWD/AWD"); }
{ const m = model(47, "Wrangler",       "SUV");       gen(m,"JK",2006,2018,"4WD"); gen(m,"JL",2018,null,"4WD"); }
{ const m = model(47, "Avenger",        "Crossover"); gen(m,"I",2022,null,"FWD/AWD"); }
{ const m = model(47, "Gladiator",      "Pickup");    gen(m,"JT",2019,null,"4WD"); }

// ── Chevrolet (48) ─────────────────────────────────────────────────────────────
{ const m = model(48, "Cruze",     "Sedan");     gen(m,"J300",2008,2015,"FWD"); gen(m,"J400",2015,2019,"FWD"); }
{ const m = model(48, "Aveo",      "Supermini"); gen(m,"T200",2002,2011,"FWD"); gen(m,"T300",2011,2018,"FWD"); }
{ const m = model(48, "Captiva",   "SUV");       gen(m,"C100",2006,2018,"FWD/AWD"); }
{ const m = model(48, "Orlando",   "MPV");       gen(m,"I",2010,2019,"FWD"); }
{ const m = model(48, "Malibu",    "Sedan");     gen(m,"VII",2012,2016,"FWD"); gen(m,"VIII",2016,null,"FWD"); }
{ const m = model(48, "Camaro",    "Coupe");     gen(m,"V",2009,2015,"RWD"); gen(m,"VI",2015,null,"RWD"); }
{ const m = model(48, "Tahoe",     "SUV");       gen(m,"III",2007,2014,"RWD/4WD"); gen(m,"IV",2014,2020,"RWD/4WD"); gen(m,"V",2020,null,"RWD/4WD"); }
{ const m = model(48, "Spark",     "Supermini"); gen(m,"M300",2009,2016,"FWD"); gen(m,"M400",2016,null,"FWD"); }
{ const m = model(48, "Trax",      "Crossover"); gen(m,"I",2012,2022,"FWD/AWD"); gen(m,"II",2022,null,"FWD/AWD"); }
{ const m = model(48, "Equinox",   "SUV");       gen(m,"III",2017,2021,"FWD/AWD"); gen(m,"IV",2023,null,"FWD/AWD"); }

// ── Dodge (49) ─────────────────────────────────────────────────────────────────
{ const m = model(49, "Challenger", "Coupe"); gen(m,"III",2008,null,"RWD/AWD"); }
{ const m = model(49, "Charger",    "Sedan"); gen(m,"VII",2011,null,"RWD/AWD"); }
{ const m = model(49, "Durango",    "SUV");   gen(m,"III",2011,null,"RWD/AWD"); }

// ── Chrysler (50) ──────────────────────────────────────────────────────────────
{ const m = model(50, "300",      "Sedan"); gen(m,"II",2011,null,"RWD/AWD"); }
{ const m = model(50, "Voyager",  "MPV");   gen(m,"V",2007,2016,"FWD"); }
{ const m = model(50, "Pacifica", "MPV");   gen(m,"I",2016,null,"FWD/AWD"); }

// ── RAM (51) ───────────────────────────────────────────────────────────────────
{ const m = model(51, "1500",  "Pickup"); gen(m,"DS",2009,2018,"RWD/4WD"); gen(m,"DT",2018,null,"RWD/4WD"); }
{ const m = model(51, "ProMaster","MPV"); gen(m,"I",2013,null,"FWD"); }

// ── Cadillac (52) ──────────────────────────────────────────────────────────────
{ const m = model(52, "CT5",      "Sedan"); gen(m,"I",2019,null,"RWD/AWD"); }
{ const m = model(52, "Escalade", "SUV");   gen(m,"III",2006,2014,"RWD/4WD"); gen(m,"IV",2014,2020,"RWD/4WD"); gen(m,"V",2020,null,"RWD/4WD"); }
{ const m = model(52, "XT5",      "SUV");   gen(m,"I",2016,null,"FWD/AWD"); }
{ const m = model(52, "CT4",      "Sedan"); gen(m,"I",2019,null,"RWD/AWD"); }
{ const m = model(52, "XT4",      "Crossover");gen(m,"I",2018,null,"FWD/AWD"); }
{ const m = model(52, "Lyriq",    "SUV");   gen(m,"I",2022,null,"RWD/AWD"); }

// ── Tesla (53) ─────────────────────────────────────────────────────────────────
{ const m = model(53, "Model S",    "Sedan");  gen(m,"I",2012,2021,"AWD"); gen(m,"Plaid",2021,null,"AWD"); }
{ const m = model(53, "Model 3",    "Sedan");  gen(m,"I",2017,2023,"RWD/AWD"); gen(m,"Highland",2023,null,"RWD/AWD"); }
{ const m = model(53, "Model X",    "SUV");    gen(m,"I",2015,2021,"AWD"); gen(m,"Plaid",2021,null,"AWD"); }
{ const m = model(53, "Model Y",    "SUV");    gen(m,"I",2020,null,"RWD/AWD"); }
{ const m = model(53, "Cybertruck", "Pickup"); gen(m,"I",2023,null,"RWD/AWD"); }

// ── Genesis (54) ───────────────────────────────────────────────────────────────
{ const m = model(54, "G70",  "Sedan");     gen(m,"I",2017,null,"RWD/AWD"); }
{ const m = model(54, "G80",  "Sedan");     gen(m,"II",2016,2020,"RWD/AWD"); gen(m,"III",2020,null,"RWD/AWD"); }
{ const m = model(54, "G90",  "Luxury");    gen(m,"II",2014,2022,"RWD/AWD"); gen(m,"III",2022,null,"RWD/AWD"); }
{ const m = model(54, "GV70", "SUV");       gen(m,"I",2021,null,"RWD/AWD"); }
{ const m = model(54, "GV80", "SUV");       gen(m,"I",2020,null,"RWD/AWD"); }
{ const m = model(54, "GV60", "Crossover"); gen(m,"I",2021,null,"RWD/AWD"); }
{ const m = model(54, "G70 Shooting Brake","Estate");gen(m,"I",2021,null,"RWD/AWD"); }

// ── Write data.json ────────────────────────────────────────────────────────────
const data = { manufacturers, models, generations };
const out = path.join(__dirname, "data.json");
fs.writeFileSync(out, JSON.stringify(data, null, "\t"), "utf8");

// ── Write class_labels.json for AI service ─────────────────────────────────────
const labelsMap = {};
for (const g of generations) {
	const mdl = models.find((m) => m.id === g.modelId);
	const mfr = manufacturers.find((m) => m.id === mdl.manufacturerId);
	const key = `${mfr.name}|${mdl.name}|${g.code}`;
	labelsMap[key] = {
		generationId: g.id,
		manufacturerName: mfr.name,
		modelName: mdl.name,
		generationCode: g.code,
		startYear: g.startYear,
		endYear: g.endYear
	};
}
const aiOut = path.join(__dirname, "..", "..", "ai-service", "model", "class_labels.json");
fs.writeFileSync(aiOut, JSON.stringify(labelsMap, null, "\t"), "utf8");

console.log(`✓ manufacturers : ${manufacturers.length}`);
console.log(`✓ models        : ${models.length}`);
console.log(`✓ generations   : ${generations.length}`);
console.log(`✓ class_labels  : ${Object.keys(labelsMap).length} entries`);
console.log(`✓ data.json     → ${out}`);
console.log(`✓ class_labels  → ${aiOut}`);
