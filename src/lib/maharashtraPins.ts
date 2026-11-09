export type MaharashtraPin = {
  pin: string;
  area: string;
  city: string;
  district: string;
  region:
    | "Pune City"
    | "PCMC"
    | "Pune Rural"
    | "Mumbai & MMR"
    | "Western Maharashtra"
    | "North Maharashtra"
    | "Marathwada"
    | "Vidarbha"
    | "Konkan";
};

export const MAHARASHTRA_PINS: MaharashtraPin[] = [
  // ── Pune City ──
  { pin: "411001", area: "Camp / Pune Station / Sassoon", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411002", area: "Bajirao Road / Shukrawar Peth / Mandai", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411003", area: "Shivajinagar Khadki / Range Hills", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411004", area: "Deccan Gymkhana / FC Road / Erandwane", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411005", area: "Shivajinagar / Model Colony / Ghole Road", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411006", area: "Yerwada / Golf Club", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411007", area: "Aundh / Pune University / Ganeshkhind", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411009", area: "Parvati / Sahakar Nagar", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411011", area: "Kasba Peth / Rasta Peth", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411014", area: "Kharadi / Viman Nagar / Chandan Nagar", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411016", area: "Senapati Bapat Road / Gokhale Nagar", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411020", area: "Khadki Cantonment", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411028", area: "Hadapsar / Magarpatta / Malwadi", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411030", area: "Sadashiv Peth / Narayan Peth / Tilak Road", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411036", area: "Mundhwa / Ghorpadi", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411037", area: "Bibvewadi / Salisbury Park / Marketyard", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411038", area: "Kothrud / Paud Road / Ideal Colony", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411040", area: "Wanowrie / Fatima Nagar / SRPF", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411041", area: "Vadgaon Budruk / Sinhagad Road / Dhayari", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411042", area: "Swargate / Guruwar Peth", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411043", area: "Dhankawadi / Katraj", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411045", area: "Baner / Balewadi", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411048", area: "Kondhwa Budruk / NIBM Road", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411051", area: "Karve Nagar / Warje", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411052", area: "Kothrud Depot / Chandani Chowk", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411058", area: "Bavdhan", city: "Pune", district: "Pune", region: "Pune City" },
  { pin: "411060", area: "Undri / Pisoli", city: "Pune", district: "Pune", region: "Pune City" },

  // ── Pimpri-Chinchwad (PCMC) ──
  { pin: "411017", area: "Pimpri Colony / Pimpri", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411018", area: "Pimpri PFR / Nehrunagar", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411019", area: "Chinchwad East / MIDC", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411026", area: "Bhosari Industrial Estate", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411027", area: "Sangvi / Pimple Gurav", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411033", area: "Chinchwadgaon / Thergaon / Kalewadi", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411034", area: "Rahatani / Pimple Saudagar", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411035", area: "Akurdi / Nigdi Pradhikaran", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411039", area: "Bhosari Gaon / Dighi", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411044", area: "Nigdi / Yamuna Nagar", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411057", area: "Wakad / Hinjewadi IT Park", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411061", area: "Pimple Nilakh / Vishal Nagar", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "411062", area: "Moshi / Alandi Road", city: "Pimpri-Chinchwad", district: "Pune", region: "PCMC" },
  { pin: "412101", area: "Talegaon Dabhade", city: "Maval", district: "Pune", region: "PCMC" },
  { pin: "412105", area: "Alandi Devachi / Markal", city: "Alandi", district: "Pune", region: "PCMC" },
  { pin: "412114", area: "Chakan MIDC / Industrial Area", city: "Chakan", district: "Pune", region: "PCMC" },

  // ── Pune District (Rural / Talukas) ──
  { pin: "410501", area: "Rajgurunagar (Khed)", city: "Khed", district: "Pune", region: "Pune Rural" },
  { pin: "410502", area: "Junnar City", city: "Junnar", district: "Pune", region: "Pune Rural" },
  { pin: "410505", area: "Narayangaon / Otur", city: "Junnar", district: "Pune", region: "Pune Rural" },
  { pin: "410506", area: "Manchar", city: "Ambegaon", district: "Pune", region: "Pune Rural" },
  { pin: "410515", area: "Ghodegaon / Bhimashankar", city: "Ambegaon", district: "Pune", region: "Pune Rural" },
  { pin: "412201", area: "Daund City", city: "Daund", district: "Pune", region: "Pune Rural" },
  { pin: "412205", area: "Saswad City", city: "Purandar", district: "Pune", region: "Pune Rural" },
  { pin: "412206", area: "Bhor City", city: "Bhor", district: "Pune", region: "Pune Rural" },
  { pin: "412207", area: "Baramati City & MIDC", city: "Baramati", district: "Pune", region: "Pune Rural" },
  { pin: "412208", area: "Shirur City", city: "Shirur", district: "Pune", region: "Pune Rural" },
  { pin: "412210", area: "Shikrapur / Sanaswadi", city: "Shirur", district: "Pune", region: "Pune Rural" },
  { pin: "412213", area: "Velhe (Rajgad)", city: "Rajgad", district: "Pune", region: "Pune Rural" },
  { pin: "412216", area: "Jejuri / Industrial Area", city: "Purandar", district: "Pune", region: "Pune Rural" },
  { pin: "412406", area: "Kedgaon / Patas", city: "Daund", district: "Pune", region: "Pune Rural" },
  { pin: "412409", area: "Someshwar Nagar", city: "Baramati", district: "Pune", region: "Pune Rural" },
  { pin: "413102", area: "Malegaon BK / Baramati Rural", city: "Baramati", district: "Pune", region: "Pune Rural" },
  { pin: "413106", area: "Indapur City", city: "Indapur", district: "Pune", region: "Pune Rural" },
  { pin: "413130", area: "Walchandnagar", city: "Indapur", district: "Pune", region: "Pune Rural" },
  { pin: "410401", area: "Lonavala / Khandala", city: "Maval", district: "Pune", region: "Pune Rural" },
  { pin: "412108", area: "Paud / Pirangut", city: "Mulshi", district: "Pune", region: "Pune Rural" },
  { pin: "412115", area: "Uruli Kanchan", city: "Haveli", district: "Pune", region: "Pune Rural" },

  // ── Mumbai & MMR ──
  { pin: "400001", area: "Fort / Churchgate / Mumbai G.P.O", city: "Mumbai", district: "Mumbai City", region: "Mumbai & MMR" },
  { pin: "400004", area: "Girgaon / Opera House", city: "Mumbai", district: "Mumbai City", region: "Mumbai & MMR" },
  { pin: "400014", area: "Dadar East / Matunga", city: "Mumbai", district: "Mumbai City", region: "Mumbai & MMR" },
  { pin: "400028", area: "Dadar West / Shivaji Park", city: "Mumbai", district: "Mumbai City", region: "Mumbai & MMR" },
  { pin: "400050", area: "Bandra West / Linking Road", city: "Mumbai", district: "Mumbai Suburban", region: "Mumbai & MMR" },
  { pin: "400051", area: "Bandra East / BKC (Bandra Kurla Complex)", city: "Mumbai", district: "Mumbai Suburban", region: "Mumbai & MMR" },
  { pin: "400058", area: "Andheri West / Lokhandwala", city: "Mumbai", district: "Mumbai Suburban", region: "Mumbai & MMR" },
  { pin: "400069", area: "Andheri East / MIDC / Chakala", city: "Mumbai", district: "Mumbai Suburban", region: "Mumbai & MMR" },
  { pin: "400077", area: "Ghatkopar East", city: "Mumbai", district: "Mumbai Suburban", region: "Mumbai & MMR" },
  { pin: "400092", area: "Borivali West", city: "Mumbai", district: "Mumbai Suburban", region: "Mumbai & MMR" },
  { pin: "400601", area: "Thane West / Station / Naupada", city: "Thane", district: "Thane", region: "Mumbai & MMR" },
  { pin: "400604", area: "Wagle Industrial Estate", city: "Thane", district: "Thane", region: "Mumbai & MMR" },
  { pin: "400703", area: "Vashi / APMC Market", city: "Navi Mumbai", district: "Thane", region: "Mumbai & MMR" },
  { pin: "400705", area: "Sanpada / Juinagar", city: "Navi Mumbai", district: "Thane", region: "Mumbai & MMR" },
  { pin: "400706", area: "Nerul / Seawoods", city: "Navi Mumbai", district: "Thane", region: "Mumbai & MMR" },
  { pin: "400708", area: "Airoli / Rabale MIDC", city: "Navi Mumbai", district: "Thane", region: "Mumbai & MMR" },
  { pin: "410206", area: "Panvel City / New Panvel", city: "Panvel", district: "Raigad", region: "Mumbai & MMR" },
  { pin: "421201", area: "Dombivli East", city: "Dombivli", district: "Thane", region: "Mumbai & MMR" },
  { pin: "421301", area: "Kalyan West", city: "Kalyan", district: "Thane", region: "Mumbai & MMR" },
  { pin: "421001", area: "Ulhasnagar", city: "Ulhasnagar", district: "Thane", region: "Mumbai & MMR" },
  { pin: "421302", area: "Bhiwandi", city: "Bhiwandi", district: "Thane", region: "Mumbai & MMR" },

  // ── Western Maharashtra ──
  { pin: "416001", area: "Kolhapur City / Bhavani Mandap / Shahupuri", city: "Kolhapur", district: "Kolhapur", region: "Western Maharashtra" },
  { pin: "416008", area: "Rajarampuri / Tarabai Park", city: "Kolhapur", district: "Kolhapur", region: "Western Maharashtra" },
  { pin: "416115", area: "Ichalkaranji Textile City", city: "Ichalkaranji", district: "Kolhapur", region: "Western Maharashtra" },
  { pin: "416416", area: "Sangli City / Gaonbhag", city: "Sangli", district: "Sangli", region: "Western Maharashtra" },
  { pin: "416410", area: "Miraj City / Medical Centre", city: "Miraj", district: "Sangli", region: "Western Maharashtra" },
  { pin: "415001", area: "Satara City / Rajwada", city: "Satara", district: "Satara", region: "Western Maharashtra" },
  { pin: "415110", area: "Karad City / Oglewadi", city: "Karad", district: "Satara", region: "Western Maharashtra" },
  { pin: "413001", area: "Solapur City / Murarji Peth", city: "Solapur", district: "Solapur", region: "Western Maharashtra" },
  { pin: "413304", area: "Pandharpur Temple Town", city: "Pandharpur", district: "Solapur", region: "Western Maharashtra" },
  { pin: "413202", area: "Barshi City", city: "Barshi", district: "Solapur", region: "Western Maharashtra" },

  // ── North Maharashtra ──
  { pin: "422001", area: "Nashik City G.P.O / Panchavati", city: "Nashik", district: "Nashik", region: "North Maharashtra" },
  { pin: "422007", area: "Nashik Road / Deolali", city: "Nashik", district: "Nashik", region: "North Maharashtra" },
  { pin: "422009", area: "CIDCO / Ambad MIDC", city: "Nashik", district: "Nashik", region: "North Maharashtra" },
  { pin: "423203", area: "Malegaon City", city: "Malegaon", district: "Nashik", region: "North Maharashtra" },
  { pin: "414001", area: "Ahilyanagar (Ahmednagar) / Savedi", city: "Ahilyanagar", district: "Ahilyanagar", region: "North Maharashtra" },
  { pin: "413709", area: "Shrirampur City", city: "Shrirampur", district: "Ahilyanagar", region: "North Maharashtra" },
  { pin: "423109", area: "Shirdi Temple Town", city: "Shirdi", district: "Ahilyanagar", region: "North Maharashtra" },
  { pin: "423601", area: "Kopargaon", city: "Kopargaon", district: "Ahilyanagar", region: "North Maharashtra" },
  { pin: "425001", area: "Jalgaon City / Navi Peth", city: "Jalgaon", district: "Jalgaon", region: "North Maharashtra" },
  { pin: "425201", area: "Bhusawal Railway Junction", city: "Bhusawal", district: "Jalgaon", region: "North Maharashtra" },
  { pin: "424001", area: "Dhule City / Agra Road", city: "Dhule", district: "Dhule", region: "North Maharashtra" },
  { pin: "425412", area: "Nandurbar City", city: "Nandurbar", district: "Nandurbar", region: "North Maharashtra" },

  // ── Marathwada ──
  { pin: "431001", area: "Chhatrapati Sambhajinagar (Aurangabad) Station", city: "Chhatrapati Sambhajinagar", district: "Chhatrapati Sambhajinagar", region: "Marathwada" },
  { pin: "431005", area: "CIDCO Colony / Cannought Garden", city: "Chhatrapati Sambhajinagar", district: "Chhatrapati Sambhajinagar", region: "Marathwada" },
  { pin: "431203", area: "Jalna City / Old Mondha", city: "Jalna", district: "Jalna", region: "Marathwada" },
  { pin: "413512", area: "Latur City / Ganj Golai", city: "Latur", district: "Latur", region: "Marathwada" },
  { pin: "431601", area: "Nanded City / Station Road", city: "Nanded", district: "Nanded", region: "Marathwada" },
  { pin: "431122", area: "Beed City / Subhash Road", city: "Beed", district: "Beed", region: "Marathwada" },
  { pin: "413501", area: "Dharashiv (Osmanabad) City", city: "Dharashiv", district: "Dharashiv", region: "Marathwada" },
  { pin: "431401", area: "Parbhani City", city: "Parbhani", district: "Parbhani", region: "Marathwada" },
  { pin: "431513", area: "Hingoli City", city: "Hingoli", district: "Hingoli", region: "Marathwada" },

  // ── Vidarbha ──
  { pin: "440001", area: "Nagpur G.P.O / Civil Lines", city: "Nagpur", district: "Nagpur", region: "Vidarbha" },
  { pin: "440010", area: "Dharampeth / Ramdaspeth", city: "Nagpur", district: "Nagpur", region: "Vidarbha" },
  { pin: "440012", area: "Sitabuldi / Cotton Market", city: "Nagpur", district: "Nagpur", region: "Vidarbha" },
  { pin: "444601", area: "Amravati City / Rajkamal Chowk", city: "Amravati", district: "Amravati", region: "Vidarbha" },
  { pin: "444001", area: "Akola City / Gandhi Road", city: "Akola", district: "Akola", region: "Vidarbha" },
  { pin: "442401", area: "Chandrapur City", city: "Chandrapur", district: "Chandrapur", region: "Vidarbha" },
  { pin: "442001", area: "Wardha City", city: "Wardha", district: "Wardha", region: "Vidarbha" },
  { pin: "445001", area: "Yavatmal City", city: "Yavatmal", district: "Yavatmal", region: "Vidarbha" },
  { pin: "441904", area: "Bhandara City", city: "Bhandara", district: "Bhandara", region: "Vidarbha" },
  { pin: "441601", area: "Gondia City", city: "Gondia", district: "Gondia", region: "Vidarbha" },
  { pin: "443001", area: "Buldhana City", city: "Buldhana", district: "Buldhana", region: "Vidarbha" },
  { pin: "442605", area: "Gadchiroli City", city: "Gadchiroli", district: "Gadchiroli", region: "Vidarbha" },

  // ── Konkan ──
  { pin: "402107", area: "Alibag City / Varsoli", city: "Alibag", district: "Raigad", region: "Konkan" },
  { pin: "402104", area: "Mahad City", city: "Mahad", district: "Raigad", region: "Konkan" },
  { pin: "415612", area: "Ratnagiri City / Mandvi", city: "Ratnagiri", district: "Ratnagiri", region: "Konkan" },
  { pin: "415605", area: "Chiplun City", city: "Chiplun", district: "Ratnagiri", region: "Konkan" },
  { pin: "416510", area: "Kankavli", city: "Kankavli", district: "Sindhudurg", region: "Konkan" },
  { pin: "416514", area: "Sawantwadi", city: "Sawantwadi", district: "Sindhudurg", region: "Konkan" },
];

export function findPin(pin: string): MaharashtraPin | undefined {
  return MAHARASHTRA_PINS.find((p) => p.pin === pin);
}

