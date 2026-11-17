/**
 * Aeroportos e regiões para os avisos de rota. Lista curada dos aeroportos com mais
 * voos (e alertas de milhas) a partir do Brasil; não é exaustiva.
 */
export type Region =
  | "Norte"
  | "Nordeste"
  | "Centro-Oeste"
  | "Sudeste"
  | "Sul"
  | "América do Sul"
  | "América do Norte"
  | "Caribe e América Central"
  | "Europa"
  | "África"
  | "Oriente Médio"
  | "Ásia"
  | "Oceania";

export const BRAZIL_REGIONS: Region[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];
export const WORLD_REGIONS: Region[] = [
  "América do Sul",
  "América do Norte",
  "Caribe e América Central",
  "Europa",
  "África",
  "Oriente Médio",
  "Ásia",
  "Oceania",
];

export type Airport = { iata: string; city: string; uf?: string; country: string; region: Region };

const br = (iata: string, city: string, uf: string, region: Region): Airport => ({ iata, city, uf, country: "Brasil", region });
const w = (iata: string, city: string, country: string, region: Region): Airport => ({ iata, city, country, region });

export const AIRPORTS: Airport[] = [
  // Sudeste
  br("GRU", "São Paulo", "SP", "Sudeste"),
  br("CGH", "São Paulo", "SP", "Sudeste"),
  br("VCP", "Campinas", "SP", "Sudeste"),
  br("RAO", "Ribeirão Preto", "SP", "Sudeste"),
  br("SJP", "São José do Rio Preto", "SP", "Sudeste"),
  br("GIG", "Rio de Janeiro", "RJ", "Sudeste"),
  br("SDU", "Rio de Janeiro", "RJ", "Sudeste"),
  br("CNF", "Belo Horizonte", "MG", "Sudeste"),
  br("PLU", "Belo Horizonte", "MG", "Sudeste"),
  br("UDI", "Uberlândia", "MG", "Sudeste"),
  br("MOC", "Montes Claros", "MG", "Sudeste"),
  br("VIX", "Vitória", "ES", "Sudeste"),
  // Sul
  br("CWB", "Curitiba", "PR", "Sul"),
  br("IGU", "Foz do Iguaçu", "PR", "Sul"),
  br("LDB", "Londrina", "PR", "Sul"),
  br("MGF", "Maringá", "PR", "Sul"),
  br("FLN", "Florianópolis", "SC", "Sul"),
  br("NVT", "Navegantes", "SC", "Sul"),
  br("JOI", "Joinville", "SC", "Sul"),
  br("XAP", "Chapecó", "SC", "Sul"),
  br("POA", "Porto Alegre", "RS", "Sul"),
  br("CXJ", "Caxias do Sul", "RS", "Sul"),
  // Centro-Oeste
  br("BSB", "Brasília", "DF", "Centro-Oeste"),
  br("GYN", "Goiânia", "GO", "Centro-Oeste"),
  br("CGB", "Cuiabá", "MT", "Centro-Oeste"),
  br("CGR", "Campo Grande", "MS", "Centro-Oeste"),
  // Nordeste
  br("SSA", "Salvador", "BA", "Nordeste"),
  br("BPS", "Porto Seguro", "BA", "Nordeste"),
  br("IOS", "Ilhéus", "BA", "Nordeste"),
  br("REC", "Recife", "PE", "Nordeste"),
  br("FEN", "Fernando de Noronha", "PE", "Nordeste"),
  br("FOR", "Fortaleza", "CE", "Nordeste"),
  br("JJD", "Jericoacoara", "CE", "Nordeste"),
  br("NAT", "Natal", "RN", "Nordeste"),
  br("JPA", "João Pessoa", "PB", "Nordeste"),
  br("MCZ", "Maceió", "AL", "Nordeste"),
  br("AJU", "Aracaju", "SE", "Nordeste"),
  br("THE", "Teresina", "PI", "Nordeste"),
  br("SLZ", "São Luís", "MA", "Nordeste"),
  // Norte
  br("BEL", "Belém", "PA", "Norte"),
  br("STM", "Santarém", "PA", "Norte"),
  br("MAO", "Manaus", "AM", "Norte"),
  br("PVH", "Porto Velho", "RO", "Norte"),
  br("RBR", "Rio Branco", "AC", "Norte"),
  br("BVB", "Boa Vista", "RR", "Norte"),
  br("MCP", "Macapá", "AP", "Norte"),
  br("PMW", "Palmas", "TO", "Norte"),
  // América do Sul
  w("EZE", "Buenos Aires", "Argentina", "América do Sul"),
  w("AEP", "Buenos Aires", "Argentina", "América do Sul"),
  w("BRC", "Bariloche", "Argentina", "América do Sul"),
  w("MDZ", "Mendoza", "Argentina", "América do Sul"),
  w("COR", "Córdoba", "Argentina", "América do Sul"),
  w("USH", "Ushuaia", "Argentina", "América do Sul"),
  w("FTE", "El Calafate", "Argentina", "América do Sul"),
  w("SCL", "Santiago", "Chile", "América do Sul"),
  w("MVD", "Montevidéu", "Uruguai", "América do Sul"),
  w("PDP", "Punta del Este", "Uruguai", "América do Sul"),
  w("ASU", "Assunção", "Paraguai", "América do Sul"),
  w("LIM", "Lima", "Peru", "América do Sul"),
  w("CUZ", "Cusco", "Peru", "América do Sul"),
  w("BOG", "Bogotá", "Colômbia", "América do Sul"),
  w("MDE", "Medellín", "Colômbia", "América do Sul"),
  w("CTG", "Cartagena", "Colômbia", "América do Sul"),
  w("UIO", "Quito", "Equador", "América do Sul"),
  w("VVI", "Santa Cruz de la Sierra", "Bolívia", "América do Sul"),
  // América do Norte
  w("MIA", "Miami", "Estados Unidos", "América do Norte"),
  w("FLL", "Fort Lauderdale", "Estados Unidos", "América do Norte"),
  w("MCO", "Orlando", "Estados Unidos", "América do Norte"),
  w("JFK", "Nova York", "Estados Unidos", "América do Norte"),
  w("EWR", "Nova York", "Estados Unidos", "América do Norte"),
  w("LGA", "Nova York", "Estados Unidos", "América do Norte"),
  w("BOS", "Boston", "Estados Unidos", "América do Norte"),
  w("IAD", "Washington", "Estados Unidos", "América do Norte"),
  w("ATL", "Atlanta", "Estados Unidos", "América do Norte"),
  w("ORD", "Chicago", "Estados Unidos", "América do Norte"),
  w("DFW", "Dallas", "Estados Unidos", "América do Norte"),
  w("IAH", "Houston", "Estados Unidos", "América do Norte"),
  w("LAX", "Los Angeles", "Estados Unidos", "América do Norte"),
  w("SFO", "São Francisco", "Estados Unidos", "América do Norte"),
  w("LAS", "Las Vegas", "Estados Unidos", "América do Norte"),
  w("YYZ", "Toronto", "Canadá", "América do Norte"),
  w("YUL", "Montreal", "Canadá", "América do Norte"),
  w("YVR", "Vancouver", "Canadá", "América do Norte"),
  w("MEX", "Cidade do México", "México", "América do Norte"),
  w("CUN", "Cancún", "México", "América do Norte"),
  // Caribe e América Central
  w("PTY", "Cidade do Panamá", "Panamá", "Caribe e América Central"),
  w("PUJ", "Punta Cana", "República Dominicana", "Caribe e América Central"),
  w("SDQ", "Santo Domingo", "República Dominicana", "Caribe e América Central"),
  w("AUA", "Aruba", "Aruba", "Caribe e América Central"),
  w("CUR", "Curaçao", "Curaçao", "Caribe e América Central"),
  w("HAV", "Havana", "Cuba", "Caribe e América Central"),
  w("SJO", "San José", "Costa Rica", "Caribe e América Central"),
  // Europa
  w("LIS", "Lisboa", "Portugal", "Europa"),
  w("OPO", "Porto", "Portugal", "Europa"),
  w("FAO", "Faro", "Portugal", "Europa"),
  w("MAD", "Madri", "Espanha", "Europa"),
  w("BCN", "Barcelona", "Espanha", "Europa"),
  w("CDG", "Paris", "França", "Europa"),
  w("ORY", "Paris", "França", "Europa"),
  w("NCE", "Nice", "França", "Europa"),
  w("LHR", "Londres", "Reino Unido", "Europa"),
  w("LGW", "Londres", "Reino Unido", "Europa"),
  w("DUB", "Dublin", "Irlanda", "Europa"),
  w("AMS", "Amsterdã", "Holanda", "Europa"),
  w("BRU", "Bruxelas", "Bélgica", "Europa"),
  w("FRA", "Frankfurt", "Alemanha", "Europa"),
  w("MUC", "Munique", "Alemanha", "Europa"),
  w("BER", "Berlim", "Alemanha", "Europa"),
  w("ZRH", "Zurique", "Suíça", "Europa"),
  w("GVA", "Genebra", "Suíça", "Europa"),
  w("VIE", "Viena", "Áustria", "Europa"),
  w("FCO", "Roma", "Itália", "Europa"),
  w("MXP", "Milão", "Itália", "Europa"),
  w("VCE", "Veneza", "Itália", "Europa"),
  w("ATH", "Atenas", "Grécia", "Europa"),
  w("IST", "Istambul", "Turquia", "Europa"),
  w("PRG", "Praga", "República Tcheca", "Europa"),
  w("BUD", "Budapeste", "Hungria", "Europa"),
  w("CPH", "Copenhague", "Dinamarca", "Europa"),
  w("HEL", "Helsinque", "Finlândia", "Europa"),
  // África
  w("JNB", "Joanesburgo", "África do Sul", "África"),
  w("CPT", "Cidade do Cabo", "África do Sul", "África"),
  w("LAD", "Luanda", "Angola", "África"),
  w("CMN", "Casablanca", "Marrocos", "África"),
  w("RAK", "Marrakech", "Marrocos", "África"),
  w("ADD", "Adis Abeba", "Etiópia", "África"),
  w("CAI", "Cairo", "Egito", "África"),
  // Oriente Médio
  w("DXB", "Dubai", "Emirados Árabes Unidos", "Oriente Médio"),
  w("AUH", "Abu Dhabi", "Emirados Árabes Unidos", "Oriente Médio"),
  w("DOH", "Doha", "Catar", "Oriente Médio"),
  w("TLV", "Tel Aviv", "Israel", "Oriente Médio"),
  // Ásia
  w("NRT", "Tóquio", "Japão", "Ásia"),
  w("HND", "Tóquio", "Japão", "Ásia"),
  w("KIX", "Osaka", "Japão", "Ásia"),
  w("ICN", "Seul", "Coreia do Sul", "Ásia"),
  w("PEK", "Pequim", "China", "Ásia"),
  w("PVG", "Xangai", "China", "Ásia"),
  w("HKG", "Hong Kong", "China", "Ásia"),
  w("SIN", "Singapura", "Singapura", "Ásia"),
  w("BKK", "Bangkok", "Tailândia", "Ásia"),
  w("DPS", "Bali", "Indonésia", "Ásia"),
  w("DEL", "Nova Délhi", "Índia", "Ásia"),
  w("MLE", "Malé", "Maldivas", "Ásia"),
  // Oceania
  w("SYD", "Sydney", "Austrália", "Oceania"),
  w("MEL", "Melbourne", "Austrália", "Oceania"),
  w("AKL", "Auckland", "Nova Zelândia", "Oceania"),
];

export const AIRPORT_BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));

export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

/** Um lugar escolhido no aviso: região, estado, país, cidade ou aeroporto, já com os códigos IATA. */
export type Place = { kind: "regiao" | "estado" | "pais" | "cidade" | "aeroporto" | "codigo"; label: string; codes: string[] };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function uniq(xs: string[]) {
  return [...new Set(xs)];
}

/** Todos os lugares selecionáveis, do mais amplo ao mais específico. */
export function allPlaces(): Place[] {
  const out: Place[] = [];
  out.push({ kind: "pais", label: "Brasil (todos)", codes: AIRPORTS.filter((a) => a.country === "Brasil").map((a) => a.iata) });
  for (const r of [...BRAZIL_REGIONS, ...WORLD_REGIONS]) {
    out.push({ kind: "regiao", label: BRAZIL_REGIONS.includes(r) ? `Região ${r}` : r, codes: AIRPORTS.filter((a) => a.region === r).map((a) => a.iata) });
  }
  for (const [uf, name] of Object.entries(UF_NAMES)) {
    const codes = AIRPORTS.filter((a) => a.uf === uf).map((a) => a.iata);
    if (codes.length) out.push({ kind: "estado", label: `${name} (${uf})`, codes });
  }
  const countries = uniq(AIRPORTS.filter((a) => a.country !== "Brasil").map((a) => a.country));
  for (const c of countries) {
    const codes = AIRPORTS.filter((a) => a.country === c).map((a) => a.iata);
    if (codes.length > 1) out.push({ kind: "pais", label: c, codes });
  }
  const cities = new Map<string, Airport[]>();
  for (const a of AIRPORTS) cities.set(`${a.city}|${a.country}`, [...(cities.get(`${a.city}|${a.country}`) ?? []), a]);
  for (const list of cities.values()) {
    if (list.length > 1) {
      out.push({ kind: "cidade", label: `${list[0].city} (todos: ${list.map((a) => a.iata).join(", ")})`, codes: list.map((a) => a.iata) });
    }
  }
  for (const a of AIRPORTS) {
    out.push({ kind: "aeroporto", label: `${a.city} (${a.iata})${a.uf ? `, ${a.uf}` : `, ${a.country}`}`, codes: [a.iata] });
  }
  return out;
}

const PLACES = allPlaces();

/** Busca por região, estado, país, cidade ou código. Um código IATA fora da lista também vale. */
export function searchPlaces(query: string, limit = 8): Place[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const scored: { p: Place; s: number }[] = [];
  for (const p of PLACES) {
    const l = norm(p.label);
    let s = -1;
    if (p.kind === "aeroporto" && p.codes[0].toLowerCase() === q) s = 0;
    else if (l.startsWith(q) || l.replace(/^regiao /, "").startsWith(q)) s = 1;
    else if (l.split(/[\s(,]+/).some((w) => w.startsWith(q))) s = 2;
    else if (l.includes(q)) s = 3;
    if (s >= 0) scored.push({ p, s });
  }
  scored.sort((a, b) => a.s - b.s);
  const out = scored.slice(0, limit).map((x) => x.p);
  if (/^[a-z]{3}$/.test(q) && !AIRPORT_BY_IATA.has(q.toUpperCase())) {
    out.unshift({ kind: "codigo", label: `Aeroporto ${q.toUpperCase()}`, codes: [q.toUpperCase()] });
  }
  return out;
}

/** Une os códigos dos lugares escolhidos (vazio = qualquer lugar). */
export function placeCodes(places: readonly Place[]) {
  return uniq(places.flatMap((p) => p.codes));
}

export function placesLabel(places: readonly Place[], empty = "Qualquer lugar") {
  if (!places.length) return empty;
  return places.map((p) => p.label.replace(/ \(todos: .*\)$/, "")).join(", ");
}

export function cityOf(iata: string) {
  return AIRPORT_BY_IATA.get(iata)?.city ?? iata;
}
