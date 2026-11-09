import { MAHARASHTRA_PINS, type MaharashtraPin } from "./maharashtraPins";

export const INDIAN_STATES = [
  "All India",
  "Maharashtra",
  "Gujarat",
  "Karnataka",
  "Delhi",
  "Uttar Pradesh",
  "Rajasthan",
  "Madhya Pradesh",
  "Tamil Nadu",
  "West Bengal",
  "Telangana",
  "Andhra Pradesh",
  "Kerala",
  "Punjab",
  "Haryana",
  "Bihar",
  "Odisha",
  "Goa",
  "Chhattisgarh",
  "Jharkhand",
  "Uttarakhand",
  "Himachal Pradesh",
  "Assam",
  "Chandigarh",
  "Jammu & Kashmir",
  "Tripura",
  "Meghalaya",
  "Manipur",
  "Nagaland",
  "Puducherry",
  "Arunachal Pradesh",
  "Mizoram",
  "Sikkim",
  "Ladakh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Andaman and Nicobar Islands",
  "Lakshadweep",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

export const POPULAR_CATEGORIES = [
  "Cooperative Credit Society",
  "Multi-State Cooperative Society",
  "Patsanstha",
  "Nagari Sahakari Patsanstha",
  "Urban Co-operative Bank",
  "Employee Credit Society",
  "Cooperative Housing Society",
  "Primary Agricultural Credit Society (PACS)",
  "Mahila Sahakari Patsanstha",
  "Thrift & Credit Cooperative Society",
];

export interface IndianHub {
  pin: string;
  city: string;
  district: string;
  state: string;
  area: string;
  region: string;
}

export const POPULAR_INDIAN_HUBS: IndianHub[] = [
  // ── Gujarat ──
  { pin: "380001", city: "Ahmedabad", district: "Ahmedabad", state: "Gujarat", area: "Lal Darwaja / Ashram Road", region: "Gujarat" },
  { pin: "380015", city: "Ahmedabad", district: "Ahmedabad", state: "Gujarat", area: "Satellite / SG Highway", region: "Gujarat" },
  { pin: "395001", city: "Surat", district: "Surat", state: "Gujarat", area: "Surat Main / Ring Road", region: "Gujarat" },
  { pin: "390001", city: "Vadodara", district: "Vadodara", state: "Gujarat", area: "Sayajigunj / Alkapuri", region: "Gujarat" },
  { pin: "360001", city: "Rajkot", district: "Rajkot", state: "Gujarat", area: "Rajkot City / Dhebar Road", region: "Gujarat" },
  { pin: "382010", city: "Gandhinagar", district: "Gandhinagar", state: "Gujarat", area: "Sector 11 / Capital Complex", region: "Gujarat" },
  { pin: "388001", city: "Anand", district: "Anand", state: "Gujarat", area: "Amul Dairy Road / Anand City", region: "Gujarat" },
  { pin: "364001", city: "Bhavnagar", district: "Bhavnagar", state: "Gujarat", area: "Waghawadi Road / City Center", region: "Gujarat" },

  // ── Karnataka ──
  { pin: "560001", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", area: "MG Road / Brigade Road", region: "Karnataka" },
  { pin: "560034", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", area: "Koramangala / HSR", region: "Karnataka" },
  { pin: "560011", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", area: "Jayanagar", region: "Karnataka" },
  { pin: "570001", city: "Mysuru", district: "Mysuru", state: "Karnataka", area: "Devaraja Mohalla / Palace", region: "Karnataka" },
  { pin: "580020", city: "Hubballi", district: "Dharwad", state: "Karnataka", area: "Hubli Main / Station Road", region: "Karnataka" },
  { pin: "590001", city: "Belagavi", district: "Belagavi", state: "Karnataka", area: "Belgaum Camp / Khade Bazar", region: "Karnataka" },
  { pin: "575001", city: "Mangaluru", district: "Dakshina Kannada", state: "Karnataka", area: "Hampankatta / Port", region: "Karnataka" },
  { pin: "585101", city: "Kalaburagi", district: "Kalaburagi", state: "Karnataka", area: "Gulbarga City Center", region: "Karnataka" },

  // ── Delhi NCR ──
  { pin: "110001", city: "New Delhi", district: "New Delhi", state: "Delhi", area: "Connaught Place / Parliament St", region: "Delhi NCR" },
  { pin: "110092", city: "Delhi", district: "East Delhi", state: "Delhi", area: "Laxmi Nagar / Preet Vihar", region: "Delhi NCR" },
  { pin: "110016", city: "New Delhi", district: "South Delhi", state: "Delhi", area: "Hauz Khas / Green Park", region: "Delhi NCR" },
  { pin: "122001", city: "Gurugram", district: "Gurugram", state: "Haryana", area: "Cyber City / Sector 14", region: "Delhi NCR" },
  { pin: "201301", city: "Noida", district: "Gautam Buddha Nagar", state: "Uttar Pradesh", area: "Sector 18 / Atta", region: "Delhi NCR" },
  { pin: "201001", city: "Ghaziabad", district: "Ghaziabad", state: "Uttar Pradesh", area: "RDC Raj Nagar / Navyug Market", region: "Delhi NCR" },

  // ── Rajasthan ──
  { pin: "302001", city: "Jaipur", district: "Jaipur", state: "Rajasthan", area: "MI Road / C-Scheme", region: "Rajasthan" },
  { pin: "302020", city: "Jaipur", district: "Jaipur", state: "Rajasthan", area: "Mansarovar / Tonk Road", region: "Rajasthan" },
  { pin: "342001", city: "Jodhpur", district: "Jodhpur", state: "Rajasthan", area: "Sojati Gate / Sardarpura", region: "Rajasthan" },
  { pin: "313001", city: "Udaipur", district: "Udaipur", state: "Rajasthan", area: "Panchwati / City Palace", region: "Rajasthan" },
  { pin: "324001", city: "Kota", district: "Kota", state: "Rajasthan", area: "Nayapura / Aerodrome Circle", region: "Rajasthan" },
  { pin: "305001", city: "Ajmer", district: "Ajmer", state: "Rajasthan", area: "Dargah Bazar / Kutchery Road", region: "Rajasthan" },

  // ── Madhya Pradesh ──
  { pin: "452001", city: "Indore", district: "Indore", state: "Madhya Pradesh", area: "Rajwada / MG Road", region: "Madhya Pradesh" },
  { pin: "452010", city: "Indore", district: "Indore", state: "Madhya Pradesh", area: "Vijay Nagar / AB Road", region: "Madhya Pradesh" },
  { pin: "462001", city: "Bhopal", district: "Bhopal", state: "Madhya Pradesh", area: "MP Nagar / Arera Hills", region: "Madhya Pradesh" },
  { pin: "482001", city: "Jabalpur", district: "Jabalpur", state: "Madhya Pradesh", area: "Wright Town / Civic Center", region: "Madhya Pradesh" },
  { pin: "474001", city: "Gwalior", district: "Gwalior", state: "Madhya Pradesh", area: "Lashkar / City Center", region: "Madhya Pradesh" },
  { pin: "456001", city: "Ujjain", district: "Ujjain", state: "Madhya Pradesh", area: "Freeganj / Mahakal Temple", region: "Madhya Pradesh" },

  // ── Uttar Pradesh ──
  { pin: "226001", city: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", area: "Hazratganj / Aminabad", region: "Uttar Pradesh" },
  { pin: "226010", city: "Lucknow", district: "Lucknow", state: "Uttar Pradesh", area: "Gomti Nagar", region: "Uttar Pradesh" },
  { pin: "208001", city: "Kanpur", district: "Kanpur Nagar", state: "Uttar Pradesh", area: "Civil Lines / Mall Road", region: "Uttar Pradesh" },
  { pin: "221001", city: "Varanasi", district: "Varanasi", state: "Uttar Pradesh", area: "Godowlia / Cantonment", region: "Uttar Pradesh" },
  { pin: "282001", city: "Agra", district: "Agra", state: "Uttar Pradesh", area: "Sanjay Place / MG Road", region: "Uttar Pradesh" },
  { pin: "211001", city: "Prayagraj", district: "Prayagraj", state: "Uttar Pradesh", area: "Civil Lines / Katra", region: "Uttar Pradesh" },

  // ── Tamil Nadu ──
  { pin: "600001", city: "Chennai", district: "Chennai", state: "Tamil Nadu", area: "Parrys / George Town", region: "Tamil Nadu" },
  { pin: "600034", city: "Chennai", district: "Chennai", state: "Tamil Nadu", area: "Nungambakkam / T Nagar", region: "Tamil Nadu" },
  { pin: "641001", city: "Coimbatore", district: "Coimbatore", state: "Tamil Nadu", area: "Gandhipuram / RS Puram", region: "Tamil Nadu" },
  { pin: "625001", city: "Madurai", district: "Madurai", state: "Tamil Nadu", area: "Town Hall / West Tower St", region: "Tamil Nadu" },
  { pin: "620001", city: "Tiruchirappalli", district: "Tiruchirappalli", state: "Tamil Nadu", area: "Main Guard Gate / Cantonment", region: "Tamil Nadu" },
  { pin: "636001", city: "Salem", district: "Salem", state: "Tamil Nadu", area: "Cherry Road / Junction", region: "Tamil Nadu" },

  // ── Telangana & Andhra Pradesh ──
  { pin: "500001", city: "Hyderabad", district: "Hyderabad", state: "Telangana", area: "Abids / Koti / Nampally", region: "Telangana" },
  { pin: "500081", city: "Hyderabad", district: "K.V.Rangareddy", state: "Telangana", area: "HITEC City / Madhapur", region: "Telangana" },
  { pin: "506001", city: "Warangal", district: "Hanamkonda", state: "Telangana", area: "Chowrasta / Main Road", region: "Telangana" },
  { pin: "530001", city: "Visakhapatnam", district: "Visakhapatnam", state: "Andhra Pradesh", area: "Daba Gardens / Jagadamba", region: "Andhra Pradesh" },
  { pin: "520001", city: "Vijayawada", district: "NTR District", state: "Andhra Pradesh", area: "Governorpet / Benz Circle", region: "Andhra Pradesh" },
  { pin: "522002", city: "Guntur", district: "Guntur", state: "Andhra Pradesh", area: "Brodipet / Arundelpet", region: "Andhra Pradesh" },

  // ── West Bengal ──
  { pin: "700001", city: "Kolkata", district: "Kolkata", state: "West Bengal", area: "BBD Bagh / Dalhousie", region: "West Bengal" },
  { pin: "700091", city: "Kolkata", district: "North 24 Parganas", state: "West Bengal", area: "Salt Lake Sector V", region: "West Bengal" },
  { pin: "711101", city: "Howrah", district: "Howrah", state: "West Bengal", area: "Howrah Station / Maidan", region: "West Bengal" },
  { pin: "734001", city: "Siliguri", district: "Darjeeling", state: "West Bengal", area: "Hill Cart Road / Sevoke Rd", region: "West Bengal" },

  // ── Kerala ──
  { pin: "695001", city: "Thiruvananthapuram", district: "Thiruvananthapuram", state: "Kerala", area: "Statue / MG Road", region: "Kerala" },
  { pin: "682001", city: "Kochi", district: "Ernakulam", state: "Kerala", area: "Fort Kochi / Marine Drive", region: "Kerala" },
  { pin: "673001", city: "Kozhikode", district: "Kozhikode", state: "Kerala", area: "SM Street / Beach Road", region: "Kerala" },
  { pin: "680001", city: "Thrissur", district: "Thrissur", state: "Kerala", area: "Swaraj Round / City Center", region: "Kerala" },

  // ── Punjab, Haryana & Chandigarh ──
  { pin: "160017", city: "Chandigarh", district: "Chandigarh", state: "Chandigarh", area: "Sector 17 Commercial City", region: "Chandigarh" },
  { pin: "141001", city: "Ludhiana", district: "Ludhiana", state: "Punjab", area: "Civil Lines / Clock Tower", region: "Punjab" },
  { pin: "143001", city: "Amritsar", district: "Amritsar", state: "Punjab", area: "Golden Temple / Town Hall", region: "Punjab" },
  { pin: "144001", city: "Jalandhar", district: "Jalandhar", state: "Punjab", area: "Model Town / GT Road", region: "Punjab" },
  { pin: "121001", city: "Faridabad", district: "Faridabad", state: "Haryana", area: "NIT / Old Faridabad", region: "Haryana" },

  // ── Bihar & Jharkhand ──
  { pin: "800001", city: "Patna", district: "Patna", state: "Bihar", area: "Fraser Road / Gandhi Maidan", region: "Bihar" },
  { pin: "834001", city: "Ranchi", district: "Ranchi", state: "Jharkhand", area: "Main Road / Doranda", region: "Jharkhand" },
  { pin: "831001", city: "Jamshedpur", district: "East Singhbhum", state: "Jharkhand", area: "Bistupur / Sakchi", region: "Jharkhand" },

  // ── Odisha ──
  { pin: "751001", city: "Bhubaneswar", district: "Khurda", state: "Odisha", area: "Master Canteen / Bapuji Nagar", region: "Odisha" },
  { pin: "753001", city: "Cuttack", district: "Cuttack", state: "Odisha", area: "Badambadi / Buxi Bazar", region: "Odisha" },

  // ── Goa ──
  { pin: "403001", city: "Panaji", district: "North Goa", state: "Goa", area: "MG Road / Campal", region: "Goa" },
  { pin: "403601", city: "Margao", district: "South Goa", state: "Goa", area: "Pajifond / Station Road", region: "Goa" },

  // ── Chhattisgarh & Uttarakhand ──
  { pin: "492001", city: "Raipur", district: "Raipur", state: "Chhattisgarh", area: "Jaistambh Chowk / Pandri", region: "Chhattisgarh" },
  { pin: "248001", city: "Dehradun", district: "Dehradun", state: "Uttarakhand", area: "Rajpur Road / Clock Tower", region: "Uttarakhand" },
  { pin: "781001", city: "Guwahati", district: "Kamrup Metropolitan", state: "Assam", area: "Paltan Bazaar / Panbazar", region: "Assam" },
];

/**
 * Infers Indian State from postal PIN code using official India Post 2-digit circle zones.
 */
export function inferStateFromPin(pin: string): string | null {
  if (!pin || pin.length < 2) return null;
  const clean = pin.trim().replace(/\D/g, "");
  if (clean.length < 2) return null;

  const prefix2 = parseInt(clean.slice(0, 2), 10);
  if (prefix2 === 11) return "Delhi";
  if (prefix2 >= 12 && prefix2 <= 13) return "Haryana";
  if (prefix2 >= 14 && prefix2 <= 15) return "Punjab";
  if (prefix2 === 16) return "Chandigarh";
  if (prefix2 === 17) return "Himachal Pradesh";
  if (prefix2 >= 18 && prefix2 <= 19) return "Jammu & Kashmir";
  if (prefix2 >= 20 && prefix2 <= 28) {
    if (prefix2 === 24 || prefix2 === 26) return "Uttarakhand";
    return "Uttar Pradesh";
  }
  if (prefix2 >= 30 && prefix2 <= 34) return "Rajasthan";
  if (prefix2 >= 36 && prefix2 <= 39) return "Gujarat";
  if (prefix2 >= 40 && prefix2 <= 44) {
    if (clean.startsWith("403")) return "Goa";
    return "Maharashtra";
  }
  if (prefix2 >= 45 && prefix2 <= 48) return "Madhya Pradesh";
  if (prefix2 === 49) return "Chhattisgarh";
  if (prefix2 >= 50 && prefix2 <= 53) {
    if (prefix2 >= 50 && prefix2 <= 51) return "Telangana";
    return "Andhra Pradesh";
  }
  if (prefix2 >= 56 && prefix2 <= 59) return "Karnataka";
  if (prefix2 >= 60 && prefix2 <= 64) {
    if (clean.startsWith("605")) return "Puducherry";
    return "Tamil Nadu";
  }
  if (prefix2 >= 67 && prefix2 <= 69) {
    if (clean.startsWith("682555")) return "Lakshadweep";
    return "Kerala";
  }
  if (prefix2 >= 70 && prefix2 <= 74) {
    if (clean.startsWith("744")) return "Andaman and Nicobar Islands";
    return "West Bengal";
  }
  if (prefix2 >= 75 && prefix2 <= 77) return "Odisha";
  if (prefix2 === 78) return "Assam";
  if (prefix2 === 79) return "North East";
  if (prefix2 >= 80 && prefix2 <= 85) {
    if (prefix2 >= 80 && prefix2 <= 82) return "Bihar";
    return "Jharkhand";
  }

  return null;
}

export function findIndiaLocation(pinOrQuery: string): {
  pin: string;
  city: string;
  district: string;
  state: string;
  area: string;
} | undefined {
  const q = pinOrQuery.trim().toLowerCase();

  // 1. Direct PIN lookup in Maharashtra PINS
  const mh = MAHARASHTRA_PINS.find((p) => p.pin === q);
  if (mh) {
    return {
      pin: mh.pin,
      city: mh.city,
      district: mh.district,
      state: "Maharashtra",
      area: mh.area,
    };
  }

  // 2. Direct PIN lookup in Popular Indian Hubs
  const hub = POPULAR_INDIAN_HUBS.find((h) => h.pin === q);
  if (hub) {
    return {
      pin: hub.pin,
      city: hub.city,
      district: hub.district,
      state: hub.state,
      area: hub.area,
    };
  }

  // 3. Match by city or area name
  const matchCity = POPULAR_INDIAN_HUBS.find(
    (h) => h.city.toLowerCase() === q || h.area.toLowerCase().includes(q)
  );
  if (matchCity) {
    return {
      pin: matchCity.pin,
      city: matchCity.city,
      district: matchCity.district,
      state: matchCity.state,
      area: matchCity.area,
    };
  }

  return undefined;
}

