// Maps each manufacturer name to its website domain.
// Clearbit returns a clean square logo PNG for each domain.
// Brands with no known domain get a null — the UI shows an initials avatar.

export const MANUFACTURER_DOMAIN = {
	"Volkswagen":     "volkswagen.com",
	"BMW":            "bmw.com",
	"Mercedes-Benz":  "mercedes-benz.com",
	"Opel":           "opel.com",
	"Ford":           "ford.com",
	"Renault":        "renault.com",
	"Peugeot":        "peugeot.com",
	"Citroën":        "citroen.com",
	"Dacia":          "dacia.ro",
	"Skoda":          "skoda-auto.com",
	"SEAT":           "seat.com",
	"Fiat":           "fiat.com",
	"Audi":           "audi.com",
	"Alfa Romeo":     "alfaromeo.com",
	"Volvo":          "volvocars.com",
	"Mini":           "mini.com",
	"Porsche":        "porsche.com",
	"Land Rover":     "landrover.com",
	"Jaguar":         "jaguar.com",
	"Smart":          "smart.com",
	"DS Automobiles": "dsautomobiles.com",
	"Cupra":          "cupraofficial.com",
	"Saab":           "saab.com",
	"Lancia":         "lancia.com",
	"Ferrari":        "ferrari.com",
	"Lamborghini":    "lamborghini.com",
	"Maserati":       "maserati.com",
	"Bentley":        "bentleymotors.com",
	"Rolls-Royce":    "rolls-roycemotorcars.com",
	"Aston Martin":   "astonmartin.com",
	"McLaren":        "mclaren.com",
	"Lotus":          "lotuscars.com",
	"Polestar":       "polestar.com",
	"MG":             "mgmotor.com",
	"Daewoo":         "daewoo.com",
	"Rover":          "rover.co.uk",
	"Toyota":         "toyota.com",
	"Honda":          "honda.com",
	"Hyundai":        "hyundai.com",
	"Kia":            "kia.com",
	"Nissan":         "nissanusa.com",
	"Mazda":          "mazda.com",
	"Mitsubishi":     "mitsubishimotors.com",
	"Suzuki":         "suzuki.com",
	"Subaru":         "subaru.com",
	"Lexus":          "lexus.com",
	"Jeep":           "jeep.com",
	"Chevrolet":      "chevrolet.com",
	"Dodge":          "dodge.com",
	"Chrysler":       "chrysler.com",
	"RAM":            "ramtrucks.com",
	"Cadillac":       "cadillac.com",
	"Tesla":          "tesla.com",
	"Genesis":        "genesis.com",
	"Infiniti":       "infiniti.com",
	"Acura":          "acura.com",
	"Lincoln":        "lincoln.com",
	"Buick":          "buick.com",
	"Koenigsegg":     "koenigsegg.com",
	"Pagani":         "pagani.com",
	"Rimac":          "rimac-automobili.com",
	"Bugatti":        "bugatti.com",
	"De Tomaso":      null,
};

const HERO_OVERRIDES = {
	"DS Automobiles": "ds_iconic.jpg",
};

export function getHeroUrl(name) {
	if (HERO_OVERRIDES[name]) {
		return `/manufacturer-heroes/${HERO_OVERRIDES[name]}`;
	}
	const slug = name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[\s-]+/g, "_")
		.replace(/[^a-z0-9_]/g, "");
	return `/manufacturer-heroes/${slug}_iconic.jpg`;
}

function nameToSlug(name) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function getLogoUrl(manufacturerName) {
	return `/logos/${nameToSlug(manufacturerName)}.png`;
}

export function getLogoUrlFallbacks(manufacturerName) {
	const domain = MANUFACTURER_DOMAIN[manufacturerName];
	if (!domain) return [];
	return [
		`https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
		`https://logo.clearbit.com/${domain}`,
	];
}

export function getInitials(name) {
	return name
		.split(/[\s-]+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() || "")
		.join("");
}
