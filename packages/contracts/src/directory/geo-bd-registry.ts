/**
 * Bangladesh geography registry for GEO_BD custom fields (ADR-127, card M.2).
 *
 * Source: Bangladesh Bureau of Statistics (BBS) administrative units as published on the
 * Bangladesh National Portal (bangladesh.gov.bd — 8 divisions, 64 districts, 495 upazilas).
 * Compiled dataset: open-admin-data/bangladesh-administrative-divisions hierarchy.json
 * (https://github.com/open-admin-data/bangladesh-administrative-divisions), CC-BY-4.0,
 * accessed 2026-10-19. Names and hierarchy are taken from that list; they are not generated.
 */

export interface GeoBdName {
  readonly bn: string;
  readonly en: string;
}

export interface GeoBdUpazila {
  readonly upazilaKey: string;
  readonly name: GeoBdName;
}

export interface GeoBdDistrict {
  readonly districtKey: string;
  readonly name: GeoBdName;
  readonly upazilas: readonly GeoBdUpazila[];
}

export interface GeoBdDivision {
  readonly divisionKey: string;
  readonly name: GeoBdName;
  readonly districts: readonly GeoBdDistrict[];
}

export const GEO_BD_DIVISIONS: readonly GeoBdDivision[] = Object.freeze(
  Object.freeze([
    Object.freeze({
      divisionKey: "barishal",
      name: Object.freeze({
        bn: "বরিশাল",
        en: "Barishal",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "barguna",
          name: Object.freeze({
            bn: "বরগুনা",
            en: "Barguna",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "amtali",
              name: Object.freeze({
                bn: "আমতলী",
                en: "Amtali",
              }),
            }),
            Object.freeze({
              upazilaKey: "bamna",
              name: Object.freeze({
                bn: "বামনা",
                en: "Bamna",
              }),
            }),
            Object.freeze({
              upazilaKey: "barguna-sadar",
              name: Object.freeze({
                bn: "বরগুনা সদর",
                en: "Barguna Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "betagi",
              name: Object.freeze({
                bn: "বেতাগী",
                en: "Betagi",
              }),
            }),
            Object.freeze({
              upazilaKey: "patharghata",
              name: Object.freeze({
                bn: "চারঘাট",
                en: "Patharghata",
              }),
            }),
            Object.freeze({
              upazilaKey: "taltali",
              name: Object.freeze({
                bn: "তালতলি",
                en: "Taltali",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "barishal",
          name: Object.freeze({
            bn: "বরিশাল",
            en: "Barishal",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "agailjhara",
              name: Object.freeze({
                bn: "আগৈলঝাড়া",
                en: "Agailjhara",
              }),
            }),
            Object.freeze({
              upazilaKey: "babuganj",
              name: Object.freeze({
                bn: "বাবুগঞ্জ",
                en: "Babuganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "bakerganj",
              name: Object.freeze({
                bn: "বাকেরগঞ্জ",
                en: "Bakerganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "banaripara",
              name: Object.freeze({
                bn: "বানারীপাড়া",
                en: "Banaripara",
              }),
            }),
            Object.freeze({
              upazilaKey: "barishal-sadar-kotwali",
              name: Object.freeze({
                bn: "বরিশাল সদর (কোতোয়ালি)",
                en: "Barishal Sadar (Kotwali)",
              }),
            }),
            Object.freeze({
              upazilaKey: "gaurnadi",
              name: Object.freeze({
                bn: "গৌরনদী",
                en: "Gaurnadi",
              }),
            }),
            Object.freeze({
              upazilaKey: "hijla",
              name: Object.freeze({
                bn: "হিজলা",
                en: "Hijla",
              }),
            }),
            Object.freeze({
              upazilaKey: "mehendiganj",
              name: Object.freeze({
                bn: "মেহেন্দিগঞ্জ",
                en: "Mehendiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "muladi",
              name: Object.freeze({
                bn: "মুলাদী",
                en: "Muladi",
              }),
            }),
            Object.freeze({
              upazilaKey: "ujirpur",
              name: Object.freeze({
                bn: "মিরপুর",
                en: "Ujirpur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "bhola",
          name: Object.freeze({
            bn: "ভোলা",
            en: "Bhola",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bhola-sadar",
              name: Object.freeze({
                bn: "ভোলা সদর",
                en: "Bhola Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "borhanuddin",
              name: Object.freeze({
                bn: "বোরহানউদ্দিন",
                en: "Borhanuddin",
              }),
            }),
            Object.freeze({
              upazilaKey: "charfasson",
              name: Object.freeze({
                bn: "চরফ্যাশন",
                en: "Charfasson",
              }),
            }),
            Object.freeze({
              upazilaKey: "daulatkhan",
              name: Object.freeze({
                bn: "দৌলতখান",
                en: "Daulatkhan",
              }),
            }),
            Object.freeze({
              upazilaKey: "lalmohan",
              name: Object.freeze({
                bn: "লালমোহন",
                en: "Lalmohan",
              }),
            }),
            Object.freeze({
              upazilaKey: "monpura",
              name: Object.freeze({
                bn: "মনপুরা",
                en: "Monpura",
              }),
            }),
            Object.freeze({
              upazilaKey: "tazumuddin",
              name: Object.freeze({
                bn: "তজুমদ্দিন",
                en: "Tazumuddin",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "jhalokati",
          name: Object.freeze({
            bn: "ঝালকাঠি",
            en: "Jhalokati",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "jhalokathi-sadar",
              name: Object.freeze({
                bn: "ঝালকাঠি সদর",
                en: "Jhalokathi Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kanthalia",
              name: Object.freeze({
                bn: "কাঠালিয়া",
                en: "Kanthalia",
              }),
            }),
            Object.freeze({
              upazilaKey: "nalchhity",
              name: Object.freeze({
                bn: "নলছিটি",
                en: "Nalchhity",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajapur",
              name: Object.freeze({
                bn: "রাজাপুর",
                en: "Rajapur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "patuakhali",
          name: Object.freeze({
            bn: "পটুয়াখালী",
            en: "Patuakhali",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bauphal",
              name: Object.freeze({
                bn: "বাউফল",
                en: "Bauphal",
              }),
            }),
            Object.freeze({
              upazilaKey: "dashmina",
              name: Object.freeze({
                bn: "দশমিনা",
                en: "Dashmina",
              }),
            }),
            Object.freeze({
              upazilaKey: "dumki",
              name: Object.freeze({
                bn: "দুমকি",
                en: "Dumki",
              }),
            }),
            Object.freeze({
              upazilaKey: "galachipa",
              name: Object.freeze({
                bn: "গলাচিপা",
                en: "Galachipa",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalapara",
              name: Object.freeze({
                bn: "কলাপাড়া",
                en: "Kalapara",
              }),
            }),
            Object.freeze({
              upazilaKey: "mirzaganj",
              name: Object.freeze({
                bn: "মির্জাগঞ্জ",
                en: "Mirzaganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "patuakhali-sadar",
              name: Object.freeze({
                bn: "পটুয়াখালী সদর",
                en: "Patuakhali Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "rangabali",
              name: Object.freeze({
                bn: "রাঙ্গাবালী",
                en: "Rangabali",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "pirojpur",
          name: Object.freeze({
            bn: "পিরোজপুর",
            en: "Pirojpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bhandaria",
              name: Object.freeze({
                bn: "ভান্ডারিয়া",
                en: "Bhandaria",
              }),
            }),
            Object.freeze({
              upazilaKey: "indurkani",
              name: Object.freeze({
                bn: "ইন্দুরকানী",
                en: "Indurkani",
              }),
            }),
            Object.freeze({
              upazilaKey: "kawkhali",
              name: Object.freeze({
                bn: "কাউখালী",
                en: "Kawkhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "mathbaria",
              name: Object.freeze({
                bn: "মঠবাড়ীয়া",
                en: "Mathbaria",
              }),
            }),
            Object.freeze({
              upazilaKey: "nazirpur",
              name: Object.freeze({
                bn: "নাজিরপুর",
                en: "Nazirpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "nesarabad-swarupkathi",
              name: Object.freeze({
                bn: "নেছারাবাদ (স্বরূপকাঠি)",
                en: "Nesarabad (Swarupkathi)",
              }),
            }),
            Object.freeze({
              upazilaKey: "pirojpur-sadar",
              name: Object.freeze({
                bn: "পিরোজপুর সদর",
                en: "Pirojpur Sadar",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "chattogram",
      name: Object.freeze({
        bn: "চট্টগ্রাম",
        en: "Chattogram",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "bandarban",
          name: Object.freeze({
            bn: "বান্দরবান",
            en: "Bandarban",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "alikadam",
              name: Object.freeze({
                bn: "আলীকদম",
                en: "Alikadam",
              }),
            }),
            Object.freeze({
              upazilaKey: "bandarban-sadar",
              name: Object.freeze({
                bn: "বান্দরবান সদর",
                en: "Bandarban Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "lama",
              name: Object.freeze({
                bn: "লামা",
                en: "Lama",
              }),
            }),
            Object.freeze({
              upazilaKey: "naikkhongchhari",
              name: Object.freeze({
                bn: "নাইক্ষ্যংছড়ি",
                en: "Naikkhongchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "rowangchhari",
              name: Object.freeze({
                bn: "রোয়াংছড়ি",
                en: "Rowangchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "ruma",
              name: Object.freeze({
                bn: "রুমা",
                en: "Ruma",
              }),
            }),
            Object.freeze({
              upazilaKey: "thanchi",
              name: Object.freeze({
                bn: "থানচি",
                en: "Thanchi",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "brahmanbaria",
          name: Object.freeze({
            bn: "ব্রাহ্মণবাড়ীয়া",
            en: "Brahmanbaria",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "akhaura",
              name: Object.freeze({
                bn: "আখাউড়া",
                en: "Akhaura",
              }),
            }),
            Object.freeze({
              upazilaKey: "ashuganj",
              name: Object.freeze({
                bn: "আশুগঞ্জ",
                en: "Ashuganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "banchharampur",
              name: Object.freeze({
                bn: "বাঞ্ছারামপুর",
                en: "Banchharampur",
              }),
            }),
            Object.freeze({
              upazilaKey: "bijoynagar",
              name: Object.freeze({
                bn: "বিজয়নগর",
                en: "Bijoynagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "brahmanbaria-sadar",
              name: Object.freeze({
                bn: "ব্রাহ্মণবাড়িয়া সদর",
                en: "Brahmanbaria Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kasba",
              name: Object.freeze({
                bn: "কসবা",
                en: "Kasba",
              }),
            }),
            Object.freeze({
              upazilaKey: "nabinagar",
              name: Object.freeze({
                bn: "নবীনগর",
                en: "Nabinagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "nasirnagar",
              name: Object.freeze({
                bn: "নাসিরনগর",
                en: "Nasirnagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "sarail",
              name: Object.freeze({
                bn: "সরাইল",
                en: "Sarail",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "chandpur",
          name: Object.freeze({
            bn: "চাঁদপুর",
            en: "Chandpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "chandpur-sadar",
              name: Object.freeze({
                bn: "চাঁদপুর সদর",
                en: "Chandpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "faridganj",
              name: Object.freeze({
                bn: "ফরিদগঞ্জ",
                en: "Faridganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "haimchar",
              name: Object.freeze({
                bn: "হাইমচর",
                en: "Haimchar",
              }),
            }),
            Object.freeze({
              upazilaKey: "hajiganj",
              name: Object.freeze({
                bn: "হাজীগঞ্জ",
                en: "Hajiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "kachua",
              name: Object.freeze({
                bn: "কচুয়া",
                en: "Kachua",
              }),
            }),
            Object.freeze({
              upazilaKey: "matlab-dakkhin",
              name: Object.freeze({
                bn: "মতলব দক্ষিণ",
                en: "Matlab Dakkhin",
              }),
            }),
            Object.freeze({
              upazilaKey: "matlab-uttar",
              name: Object.freeze({
                bn: "মতলব উত্তর",
                en: "Matlab Uttar",
              }),
            }),
            Object.freeze({
              upazilaKey: "shahrasti",
              name: Object.freeze({
                bn: "শাহরাস্তি",
                en: "Shahrasti",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "chattogram",
          name: Object.freeze({
            bn: "চট্টগ্রাম",
            en: "Chattogram",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "anwara",
              name: Object.freeze({
                bn: "আনোয়ারা",
                en: "Anwara",
              }),
            }),
            Object.freeze({
              upazilaKey: "banshkhali",
              name: Object.freeze({
                bn: "বাঁশখালী",
                en: "Banshkhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "boalkhali",
              name: Object.freeze({
                bn: "বোয়ালখালী",
                en: "Boalkhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "chandanaish",
              name: Object.freeze({
                bn: "চন্দনাইশ",
                en: "Chandanaish",
              }),
            }),
            Object.freeze({
              upazilaKey: "fatikchhari",
              name: Object.freeze({
                bn: "ফটিকছড়ি",
                en: "Fatikchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "hathazari",
              name: Object.freeze({
                bn: "হাটহাজারী",
                en: "Hathazari",
              }),
            }),
            Object.freeze({
              upazilaKey: "karnaphuli",
              name: Object.freeze({
                bn: "কর্ণফুলী",
                en: "Karnaphuli",
              }),
            }),
            Object.freeze({
              upazilaKey: "lohagara",
              name: Object.freeze({
                bn: "লোহাগড়া",
                en: "Lohagara",
              }),
            }),
            Object.freeze({
              upazilaKey: "mirsarai",
              name: Object.freeze({
                bn: "সরাইল",
                en: "Mirsarai",
              }),
            }),
            Object.freeze({
              upazilaKey: "patiya",
              name: Object.freeze({
                bn: "পটিয়া",
                en: "Patiya",
              }),
            }),
            Object.freeze({
              upazilaKey: "rangunia",
              name: Object.freeze({
                bn: "রাঙ্গুনিয়া",
                en: "Rangunia",
              }),
            }),
            Object.freeze({
              upazilaKey: "raozan",
              name: Object.freeze({
                bn: "রাউজান",
                en: "Raozan",
              }),
            }),
            Object.freeze({
              upazilaKey: "sandwip",
              name: Object.freeze({
                bn: "সন্দ্বীপ",
                en: "Sandwip",
              }),
            }),
            Object.freeze({
              upazilaKey: "satkania",
              name: Object.freeze({
                bn: "সাতকানিয়া",
                en: "Satkania",
              }),
            }),
            Object.freeze({
              upazilaKey: "sitakunda",
              name: Object.freeze({
                bn: "সীতাকুন্ড",
                en: "Sitakunda",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "cumilla",
          name: Object.freeze({
            bn: "কুমিল্লা",
            en: "Cumilla",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "adarsha-sadar",
              name: Object.freeze({
                bn: "আদর্শ সদর",
                en: "Adarsha Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "barura",
              name: Object.freeze({
                bn: "বরুড়া",
                en: "Barura",
              }),
            }),
            Object.freeze({
              upazilaKey: "brahmanpara",
              name: Object.freeze({
                bn: "ব্রাহ্মণপাড়া",
                en: "Brahmanpara",
              }),
            }),
            Object.freeze({
              upazilaKey: "burichang",
              name: Object.freeze({
                bn: "বুড়িচং",
                en: "Burichang",
              }),
            }),
            Object.freeze({
              upazilaKey: "chandina",
              name: Object.freeze({
                bn: "চান্দিনা",
                en: "Chandina",
              }),
            }),
            Object.freeze({
              upazilaKey: "chauddagram",
              name: Object.freeze({
                bn: "চৌদ্দগ্রাম",
                en: "Chauddagram",
              }),
            }),
            Object.freeze({
              upazilaKey: "daudkandi",
              name: Object.freeze({
                bn: "দাউদকান্দি",
                en: "Daudkandi",
              }),
            }),
            Object.freeze({
              upazilaKey: "debidwar",
              name: Object.freeze({
                bn: "দেবিদ্বার",
                en: "Debidwar",
              }),
            }),
            Object.freeze({
              upazilaKey: "homna",
              name: Object.freeze({
                bn: "হোমনা",
                en: "Homna",
              }),
            }),
            Object.freeze({
              upazilaKey: "laksam",
              name: Object.freeze({
                bn: "লাকসাম",
                en: "Laksam",
              }),
            }),
            Object.freeze({
              upazilaKey: "lalmai",
              name: Object.freeze({
                bn: "লালমাই",
                en: "Lalmai",
              }),
            }),
            Object.freeze({
              upazilaKey: "manoharganj",
              name: Object.freeze({
                bn: "মনোহরগঞ্জ",
                en: "Manoharganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "meghna",
              name: Object.freeze({
                bn: "মেঘনা",
                en: "Meghna",
              }),
            }),
            Object.freeze({
              upazilaKey: "muradnagar",
              name: Object.freeze({
                bn: "মুরাদনগর",
                en: "Muradnagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "nangalkot",
              name: Object.freeze({
                bn: "নাঙ্গলকোট",
                en: "Nangalkot",
              }),
            }),
            Object.freeze({
              upazilaKey: "sadar-dakkhin",
              name: Object.freeze({
                bn: "সদর দক্ষিণ",
                en: "Sadar Dakkhin",
              }),
            }),
            Object.freeze({
              upazilaKey: "titas",
              name: Object.freeze({
                bn: "তিতাস",
                en: "Titas",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "coxs-bazar",
          name: Object.freeze({
            bn: "কক্সবাজার",
            en: "Cox's Bazar",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "chakaria",
              name: Object.freeze({
                bn: "চকরিয়া",
                en: "Chakaria",
              }),
            }),
            Object.freeze({
              upazilaKey: "coxs-bazar-sadar",
              name: Object.freeze({
                bn: "কক্সবাজার সদর",
                en: "Coxs Bazar Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "eidgaon",
              name: Object.freeze({
                bn: "ঈদগাঁও",
                en: "Eidgaon",
              }),
            }),
            Object.freeze({
              upazilaKey: "kutubdia",
              name: Object.freeze({
                bn: "কুতুবদিয়া",
                en: "Kutubdia",
              }),
            }),
            Object.freeze({
              upazilaKey: "maheshkhali",
              name: Object.freeze({
                bn: "মহেশখালী",
                en: "Maheshkhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "pekua",
              name: Object.freeze({
                bn: "পেকুয়া",
                en: "Pekua",
              }),
            }),
            Object.freeze({
              upazilaKey: "ramu",
              name: Object.freeze({
                bn: "রামু",
                en: "Ramu",
              }),
            }),
            Object.freeze({
              upazilaKey: "teknaf",
              name: Object.freeze({
                bn: "টেকনাফ",
                en: "Teknaf",
              }),
            }),
            Object.freeze({
              upazilaKey: "ukhia",
              name: Object.freeze({
                bn: "উখিয়া",
                en: "Ukhia",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "feni",
          name: Object.freeze({
            bn: "ফেনী",
            en: "Feni",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "chhagalnaiya",
              name: Object.freeze({
                bn: "ছাগলনাইয়া",
                en: "Chhagalnaiya",
              }),
            }),
            Object.freeze({
              upazilaKey: "daganbhuiyan",
              name: Object.freeze({
                bn: "দাগনভূঞা",
                en: "Daganbhuiyan",
              }),
            }),
            Object.freeze({
              upazilaKey: "feni-sadar",
              name: Object.freeze({
                bn: "ফেনী সদর",
                en: "Feni Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "fulgazi",
              name: Object.freeze({
                bn: "ফুলগাজী",
                en: "Fulgazi",
              }),
            }),
            Object.freeze({
              upazilaKey: "parashuram",
              name: Object.freeze({
                bn: "পরশুরাম",
                en: "Parashuram",
              }),
            }),
            Object.freeze({
              upazilaKey: "sonagazi",
              name: Object.freeze({
                bn: "সোনাগাজী",
                en: "Sonagazi",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "khagrachhari",
          name: Object.freeze({
            bn: "খাগড়াছড়ি",
            en: "Khagrachhari",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "dighinala",
              name: Object.freeze({
                bn: "দিঘীনালা",
                en: "Dighinala",
              }),
            }),
            Object.freeze({
              upazilaKey: "guimara",
              name: Object.freeze({
                bn: "গুইমারা",
                en: "Guimara",
              }),
            }),
            Object.freeze({
              upazilaKey: "khagrachhari-sadar",
              name: Object.freeze({
                bn: "খাগড়াছড়ি সদর",
                en: "Khagrachhari Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "lakkhichhari",
              name: Object.freeze({
                bn: "লক্ষ্মীছড়ি",
                en: "Lakkhichhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "mahalchhari",
              name: Object.freeze({
                bn: "মহালছড়ি",
                en: "Mahalchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "manikchhari",
              name: Object.freeze({
                bn: "ফটিকছড়ি",
                en: "Manikchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "matiranga",
              name: Object.freeze({
                bn: "মাটিরাঙ্গা",
                en: "Matiranga",
              }),
            }),
            Object.freeze({
              upazilaKey: "panchhari",
              name: Object.freeze({
                bn: "পানছড়ি",
                en: "Panchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "ramgarh",
              name: Object.freeze({
                bn: "রামগড়",
                en: "Ramgarh",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "lakshmipur",
          name: Object.freeze({
            bn: "লক্ষ্মীপুর",
            en: "Lakshmipur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "kamalnagar",
              name: Object.freeze({
                bn: "কমলনগর",
                en: "Kamalnagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "lakshmipur-sadar",
              name: Object.freeze({
                bn: "লক্ষ্মীপুর সদর",
                en: "Lakshmipur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "raipur",
              name: Object.freeze({
                bn: "রায়পুর",
                en: "Raipur",
              }),
            }),
            Object.freeze({
              upazilaKey: "ramganj",
              name: Object.freeze({
                bn: "রামগঞ্জ",
                en: "Ramganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "ramgati",
              name: Object.freeze({
                bn: "রামগতি",
                en: "Ramgati",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "noakhali",
          name: Object.freeze({
            bn: "নোয়াখালী",
            en: "Noakhali",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "begumganj",
              name: Object.freeze({
                bn: "বেগমগঞ্জ",
                en: "Begumganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "chatkhil",
              name: Object.freeze({
                bn: "চাটখিল",
                en: "Chatkhil",
              }),
            }),
            Object.freeze({
              upazilaKey: "companiganj",
              name: Object.freeze({
                bn: "কোম্পানীগঞ্জ",
                en: "Companiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "hatiya",
              name: Object.freeze({
                bn: "পটিয়া",
                en: "Hatiya",
              }),
            }),
            Object.freeze({
              upazilaKey: "kabirhat",
              name: Object.freeze({
                bn: "কবিরহাট",
                en: "Kabirhat",
              }),
            }),
            Object.freeze({
              upazilaKey: "noakhali-sadar",
              name: Object.freeze({
                bn: "নোয়াখালী সদর",
                en: "Noakhali Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "senbag",
              name: Object.freeze({
                bn: "সেনবাগ",
                en: "Senbag",
              }),
            }),
            Object.freeze({
              upazilaKey: "sonaimuri",
              name: Object.freeze({
                bn: "সোনাইমুড়ী",
                en: "Sonaimuri",
              }),
            }),
            Object.freeze({
              upazilaKey: "subarnachar",
              name: Object.freeze({
                bn: "সুবর্ণচর",
                en: "Subarnachar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "rangamati",
          name: Object.freeze({
            bn: "রাঙ্গামাটি",
            en: "Rangamati",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "baghaichhari",
              name: Object.freeze({
                bn: "বাঘাইছড়ি",
                en: "Baghaichhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "barkal",
              name: Object.freeze({
                bn: "বরকল",
                en: "Barkal",
              }),
            }),
            Object.freeze({
              upazilaKey: "belaichhari",
              name: Object.freeze({
                bn: "বিলাইছড়ি",
                en: "Belaichhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "jurachhari",
              name: Object.freeze({
                bn: "জুরাছড়ি",
                en: "Jurachhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaptai",
              name: Object.freeze({
                bn: "কাপ্তাই",
                en: "Kaptai",
              }),
            }),
            Object.freeze({
              upazilaKey: "kawkhali",
              name: Object.freeze({
                bn: "কাউখালী",
                en: "Kawkhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "langadu",
              name: Object.freeze({
                bn: "লংগদু",
                en: "Langadu",
              }),
            }),
            Object.freeze({
              upazilaKey: "naniarchar",
              name: Object.freeze({
                bn: "নানিয়ারচর",
                en: "Naniarchar",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajasthali",
              name: Object.freeze({
                bn: "রাজস্থলী",
                en: "Rajasthali",
              }),
            }),
            Object.freeze({
              upazilaKey: "rangamati-sadar",
              name: Object.freeze({
                bn: "রাঙ্গামাটি সদর",
                en: "Rangamati Sadar",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "dhaka",
      name: Object.freeze({
        bn: "ঢাকা",
        en: "Dhaka",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "dhaka",
          name: Object.freeze({
            bn: "ঢাকা",
            en: "Dhaka",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "dhamrai",
              name: Object.freeze({
                bn: "ধামরাই",
                en: "Dhamrai",
              }),
            }),
            Object.freeze({
              upazilaKey: "dohar",
              name: Object.freeze({
                bn: "দোহার",
                en: "Dohar",
              }),
            }),
            Object.freeze({
              upazilaKey: "keraniganj",
              name: Object.freeze({
                bn: "কেরাণীগঞ্জ",
                en: "Keraniganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "nawabganj",
              name: Object.freeze({
                bn: "নবাবগঞ্জ",
                en: "Nawabganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "savar",
              name: Object.freeze({
                bn: "সাভার",
                en: "Savar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "faridpur",
          name: Object.freeze({
            bn: "ফরিদপুর",
            en: "Faridpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "alfadanga",
              name: Object.freeze({
                bn: "আলফাডাঙ্গা",
                en: "Alfadanga",
              }),
            }),
            Object.freeze({
              upazilaKey: "bhanga",
              name: Object.freeze({
                bn: "ভাঙ্গা",
                en: "Bhanga",
              }),
            }),
            Object.freeze({
              upazilaKey: "boalmari",
              name: Object.freeze({
                bn: "বোয়ালমারী",
                en: "Boalmari",
              }),
            }),
            Object.freeze({
              upazilaKey: "char-bhadrasan",
              name: Object.freeze({
                bn: "চরভদ্রাসন",
                en: "Char Bhadrasan",
              }),
            }),
            Object.freeze({
              upazilaKey: "faridpur-sadar",
              name: Object.freeze({
                bn: "ফরিদপুর সদর",
                en: "Faridpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "madhukhali",
              name: Object.freeze({
                bn: "মধুখালী",
                en: "Madhukhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "nagarkanda",
              name: Object.freeze({
                bn: "নগরকান্দা",
                en: "Nagarkanda",
              }),
            }),
            Object.freeze({
              upazilaKey: "sadarpur",
              name: Object.freeze({
                bn: "সদরপুর",
                en: "Sadarpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "saltha",
              name: Object.freeze({
                bn: "সালথা",
                en: "Saltha",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "gazipur",
          name: Object.freeze({
            bn: "গাজীপুর",
            en: "Gazipur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "gazipur-sadar",
              name: Object.freeze({
                bn: "গাজীপুর সদর",
                en: "Gazipur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaliakair",
              name: Object.freeze({
                bn: "কালিয়াকৈর",
                en: "Kaliakair",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaliganj",
              name: Object.freeze({
                bn: "কালীগঞ্জ",
                en: "Kaliganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "kapasia",
              name: Object.freeze({
                bn: "কাপাসিয়া",
                en: "Kapasia",
              }),
            }),
            Object.freeze({
              upazilaKey: "sreepur",
              name: Object.freeze({
                bn: "শ্রীপুর",
                en: "Sreepur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "gopalganj",
          name: Object.freeze({
            bn: "গোপালগঞ্জ",
            en: "Gopalganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "gopalganj-sadar",
              name: Object.freeze({
                bn: "গোপালগঞ্জ সদর",
                en: "Gopalganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kashiani",
              name: Object.freeze({
                bn: "কাশিয়ানী",
                en: "Kashiani",
              }),
            }),
            Object.freeze({
              upazilaKey: "kotalipara",
              name: Object.freeze({
                bn: "কোটালীপাড়া",
                en: "Kotalipara",
              }),
            }),
            Object.freeze({
              upazilaKey: "muksudpur",
              name: Object.freeze({
                bn: "মুকসুদপুর",
                en: "Muksudpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "tungipara",
              name: Object.freeze({
                bn: "টুংগীপাড়া",
                en: "Tungipara",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "kishoreganj",
          name: Object.freeze({
            bn: "কিশোরগঞ্জ",
            en: "Kishoreganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "austagram",
              name: Object.freeze({
                bn: "অষ্টগ্রাম",
                en: "Austagram",
              }),
            }),
            Object.freeze({
              upazilaKey: "bajitpur",
              name: Object.freeze({
                bn: "বাজিতপুর",
                en: "Bajitpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "bhairab",
              name: Object.freeze({
                bn: "ভৈরব",
                en: "Bhairab",
              }),
            }),
            Object.freeze({
              upazilaKey: "hossainpur",
              name: Object.freeze({
                bn: "হোসেনপুর",
                en: "Hossainpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "itna",
              name: Object.freeze({
                bn: "ইটনা",
                en: "Itna",
              }),
            }),
            Object.freeze({
              upazilaKey: "karimganj",
              name: Object.freeze({
                bn: "করিমগঞ্জ",
                en: "Karimganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "katiadi",
              name: Object.freeze({
                bn: "কটিয়াদী",
                en: "Katiadi",
              }),
            }),
            Object.freeze({
              upazilaKey: "kishoreganj-sadar",
              name: Object.freeze({
                bn: "কিশোরগঞ্জ সদর",
                en: "Kishoreganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kuliarchar",
              name: Object.freeze({
                bn: "কুলিয়ারচর",
                en: "Kuliarchar",
              }),
            }),
            Object.freeze({
              upazilaKey: "mithamain",
              name: Object.freeze({
                bn: "মিঠামইন",
                en: "Mithamain",
              }),
            }),
            Object.freeze({
              upazilaKey: "nikli",
              name: Object.freeze({
                bn: "নিকলী",
                en: "Nikli",
              }),
            }),
            Object.freeze({
              upazilaKey: "pakundia",
              name: Object.freeze({
                bn: "পাকুন্দিয়া",
                en: "Pakundia",
              }),
            }),
            Object.freeze({
              upazilaKey: "tarail",
              name: Object.freeze({
                bn: "তাড়াইল",
                en: "Tarail",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "madaripur",
          name: Object.freeze({
            bn: "মাদারীপুর",
            en: "Madaripur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "dasar",
              name: Object.freeze({
                bn: "ডাসার",
                en: "Dasar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalkini",
              name: Object.freeze({
                bn: "কালকিনি",
                en: "Kalkini",
              }),
            }),
            Object.freeze({
              upazilaKey: "madaripur-sadar",
              name: Object.freeze({
                bn: "মাদারীপুর সদর",
                en: "Madaripur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajoir",
              name: Object.freeze({
                bn: "রাজৈর",
                en: "Rajoir",
              }),
            }),
            Object.freeze({
              upazilaKey: "shibchar",
              name: Object.freeze({
                bn: "শিবচর",
                en: "Shibchar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "manikganj",
          name: Object.freeze({
            bn: "মানিকগঞ্জ",
            en: "Manikganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "daulatpur",
              name: Object.freeze({
                bn: "দৌলতপুর",
                en: "Daulatpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "ghior",
              name: Object.freeze({
                bn: "ঘিওর",
                en: "Ghior",
              }),
            }),
            Object.freeze({
              upazilaKey: "harirampur",
              name: Object.freeze({
                bn: "হরিরামপুর",
                en: "Harirampur",
              }),
            }),
            Object.freeze({
              upazilaKey: "manikganj-sadar",
              name: Object.freeze({
                bn: "মানিকগঞ্জ সদর",
                en: "Manikganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "saturia",
              name: Object.freeze({
                bn: "সাটুরিয়া",
                en: "Saturia",
              }),
            }),
            Object.freeze({
              upazilaKey: "shibalay",
              name: Object.freeze({
                bn: "শিবালয়",
                en: "Shibalay",
              }),
            }),
            Object.freeze({
              upazilaKey: "singair",
              name: Object.freeze({
                bn: "সিংগাইর",
                en: "Singair",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "munshiganj",
          name: Object.freeze({
            bn: "মুন্সিগঞ্জ",
            en: "Munshiganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "gazaria",
              name: Object.freeze({
                bn: "গজারিয়া",
                en: "Gazaria",
              }),
            }),
            Object.freeze({
              upazilaKey: "louhajang",
              name: Object.freeze({
                bn: "লৌহজং",
                en: "Louhajang",
              }),
            }),
            Object.freeze({
              upazilaKey: "munshiganj-sadar",
              name: Object.freeze({
                bn: "মুন্সিগঞ্জ সদর",
                en: "Munshiganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "sirajdikhan",
              name: Object.freeze({
                bn: "সিরাজদিখান",
                en: "Sirajdikhan",
              }),
            }),
            Object.freeze({
              upazilaKey: "sreenagar",
              name: Object.freeze({
                bn: "শ্রীনগর",
                en: "Sreenagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "tongibari",
              name: Object.freeze({
                bn: "টংগীবাড়ি",
                en: "Tongibari",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "narayanganj",
          name: Object.freeze({
            bn: "নারায়ণগঞ্জ",
            en: "Narayanganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "araihazar",
              name: Object.freeze({
                bn: "আড়াইহাজার",
                en: "Araihazar",
              }),
            }),
            Object.freeze({
              upazilaKey: "bandar",
              name: Object.freeze({
                bn: "বন্দর",
                en: "Bandar",
              }),
            }),
            Object.freeze({
              upazilaKey: "narayanganj-sadar",
              name: Object.freeze({
                bn: "নারায়নগঞ্জ সদর",
                en: "Narayanganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "rupganj",
              name: Object.freeze({
                bn: "রূপগঞ্জ",
                en: "Rupganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "sonargaon",
              name: Object.freeze({
                bn: "সোনারগাঁ",
                en: "Sonargaon",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "narsingdi",
          name: Object.freeze({
            bn: "নরসিংদী",
            en: "Narsingdi",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "belabo",
              name: Object.freeze({
                bn: "বেলাবো",
                en: "Belabo",
              }),
            }),
            Object.freeze({
              upazilaKey: "manohardi",
              name: Object.freeze({
                bn: "মনোহরদী",
                en: "Manohardi",
              }),
            }),
            Object.freeze({
              upazilaKey: "narsingdi-sadar",
              name: Object.freeze({
                bn: "নরসিংদী সদর",
                en: "Narsingdi Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "palash",
              name: Object.freeze({
                bn: "পলাশ",
                en: "Palash",
              }),
            }),
            Object.freeze({
              upazilaKey: "raipura",
              name: Object.freeze({
                bn: "রায়পুরা",
                en: "Raipura",
              }),
            }),
            Object.freeze({
              upazilaKey: "shibpur",
              name: Object.freeze({
                bn: "শিবপুর",
                en: "Shibpur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "rajbari",
          name: Object.freeze({
            bn: "রাজবাড়ী",
            en: "Rajbari",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "baliakandi",
              name: Object.freeze({
                bn: "বালিয়াকান্দি",
                en: "Baliakandi",
              }),
            }),
            Object.freeze({
              upazilaKey: "goalanda",
              name: Object.freeze({
                bn: "গোয়ালন্দ",
                en: "Goalanda",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalukhali",
              name: Object.freeze({
                bn: "কালুখালী",
                en: "Kalukhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "pangsha",
              name: Object.freeze({
                bn: "পাংশা",
                en: "Pangsha",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajbari-sadar",
              name: Object.freeze({
                bn: "রাজবাড়ী সদর",
                en: "Rajbari Sadar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "shariatpur",
          name: Object.freeze({
            bn: "শরিয়তপুর",
            en: "Shariatpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bhedarganj",
              name: Object.freeze({
                bn: "ভেদরগঞ্জ",
                en: "Bhedarganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "damudya",
              name: Object.freeze({
                bn: "ডামুড্যা",
                en: "Damudya",
              }),
            }),
            Object.freeze({
              upazilaKey: "gosairhat",
              name: Object.freeze({
                bn: "গোসাইরহাট",
                en: "Gosairhat",
              }),
            }),
            Object.freeze({
              upazilaKey: "naria",
              name: Object.freeze({
                bn: "নড়িয়া",
                en: "Naria",
              }),
            }),
            Object.freeze({
              upazilaKey: "shariatpur-sadar",
              name: Object.freeze({
                bn: "শরিয়তপুর সদর",
                en: "Shariatpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "zajira",
              name: Object.freeze({
                bn: "জাজিরা",
                en: "Zajira",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "tangail",
          name: Object.freeze({
            bn: "টাঙ্গাইল",
            en: "Tangail",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "basail",
              name: Object.freeze({
                bn: "বাসাইল",
                en: "Basail",
              }),
            }),
            Object.freeze({
              upazilaKey: "bhuanpur",
              name: Object.freeze({
                bn: "ভূঞাপুর",
                en: "Bhuanpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "delduar",
              name: Object.freeze({
                bn: "দেলদুয়ার",
                en: "Delduar",
              }),
            }),
            Object.freeze({
              upazilaKey: "dhanbari",
              name: Object.freeze({
                bn: "ধনবাড়ী",
                en: "Dhanbari",
              }),
            }),
            Object.freeze({
              upazilaKey: "ghatail",
              name: Object.freeze({
                bn: "ঘাটাইল",
                en: "Ghatail",
              }),
            }),
            Object.freeze({
              upazilaKey: "gopalpur",
              name: Object.freeze({
                bn: "গোপালপুর",
                en: "Gopalpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalihati",
              name: Object.freeze({
                bn: "কালিহাতী",
                en: "Kalihati",
              }),
            }),
            Object.freeze({
              upazilaKey: "madhupur",
              name: Object.freeze({
                bn: "মধুপুর",
                en: "Madhupur",
              }),
            }),
            Object.freeze({
              upazilaKey: "mirzapur",
              name: Object.freeze({
                bn: "মির্জাপুর",
                en: "Mirzapur",
              }),
            }),
            Object.freeze({
              upazilaKey: "nagarpur",
              name: Object.freeze({
                bn: "নাগরপুর",
                en: "Nagarpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "sakhipur",
              name: Object.freeze({
                bn: "সখিপুর",
                en: "Sakhipur",
              }),
            }),
            Object.freeze({
              upazilaKey: "tangail-sadar",
              name: Object.freeze({
                bn: "টাঙ্গাইল সদর",
                en: "Tangail Sadar",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "khulna",
      name: Object.freeze({
        bn: "খুলনা",
        en: "Khulna",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "bagerhat",
          name: Object.freeze({
            bn: "বাগেরহাট",
            en: "Bagerhat",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bagerhat-sadar",
              name: Object.freeze({
                bn: "বাগেরহাট সদর",
                en: "Bagerhat Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "chitalmari",
              name: Object.freeze({
                bn: "চিতলমারী",
                en: "Chitalmari",
              }),
            }),
            Object.freeze({
              upazilaKey: "fakirhat",
              name: Object.freeze({
                bn: "ফকিরহাট",
                en: "Fakirhat",
              }),
            }),
            Object.freeze({
              upazilaKey: "kachua",
              name: Object.freeze({
                bn: "কচুয়া",
                en: "Kachua",
              }),
            }),
            Object.freeze({
              upazilaKey: "mollahat",
              name: Object.freeze({
                bn: "মোল্লাহাট",
                en: "Mollahat",
              }),
            }),
            Object.freeze({
              upazilaKey: "mongla",
              name: Object.freeze({
                bn: "মোংলা",
                en: "Mongla",
              }),
            }),
            Object.freeze({
              upazilaKey: "morelganj",
              name: Object.freeze({
                bn: "মোড়েলগঞ্জ",
                en: "Morelganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "rampal",
              name: Object.freeze({
                bn: "রামপাল",
                en: "Rampal",
              }),
            }),
            Object.freeze({
              upazilaKey: "sharankhola",
              name: Object.freeze({
                bn: "শরণখোলা",
                en: "Sharankhola",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "chuadanga",
          name: Object.freeze({
            bn: "চুয়াডাঙ্গা",
            en: "Chuadanga",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "alamdanga",
              name: Object.freeze({
                bn: "আলমডাঙ্গা",
                en: "Alamdanga",
              }),
            }),
            Object.freeze({
              upazilaKey: "chuadanga-sadar",
              name: Object.freeze({
                bn: "চুয়াডাঙ্গা সদর",
                en: "Chuadanga Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "damurhuda",
              name: Object.freeze({
                bn: "দামুড়হুদা",
                en: "Damurhuda",
              }),
            }),
            Object.freeze({
              upazilaKey: "jibannagar",
              name: Object.freeze({
                bn: "জীবননগর",
                en: "Jibannagar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "jashore",
          name: Object.freeze({
            bn: "যশোর",
            en: "Jashore",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "abhaynagar",
              name: Object.freeze({
                bn: "অভয়নগর",
                en: "Abhaynagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "bagharpara",
              name: Object.freeze({
                bn: "বাঘারপাড়া",
                en: "Bagharpara",
              }),
            }),
            Object.freeze({
              upazilaKey: "chaugachha",
              name: Object.freeze({
                bn: "চৌগাছা",
                en: "Chaugachha",
              }),
            }),
            Object.freeze({
              upazilaKey: "jashore-sadar",
              name: Object.freeze({
                bn: "নাটোর সদর",
                en: "Jashore Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "jhikargachha",
              name: Object.freeze({
                bn: "ঝিকরগাছা",
                en: "Jhikargachha",
              }),
            }),
            Object.freeze({
              upazilaKey: "keshabpur",
              name: Object.freeze({
                bn: "কেশবপুর",
                en: "Keshabpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "manirampur",
              name: Object.freeze({
                bn: "মণিরামপুর",
                en: "Manirampur",
              }),
            }),
            Object.freeze({
              upazilaKey: "sharsha",
              name: Object.freeze({
                bn: "শার্শা",
                en: "Sharsha",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "jhenaidah",
          name: Object.freeze({
            bn: "ঝিনাইদহ",
            en: "Jhenaidah",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "harinakundu",
              name: Object.freeze({
                bn: "হরিণাকুন্ডু",
                en: "Harinakundu",
              }),
            }),
            Object.freeze({
              upazilaKey: "jhenaidah-sadar",
              name: Object.freeze({
                bn: "ঝিনাইদহ সদর",
                en: "Jhenaidah Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaliganj",
              name: Object.freeze({
                bn: "কালীগঞ্জ",
                en: "Kaliganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "kotchandpur",
              name: Object.freeze({
                bn: "কোটচাঁদপুর",
                en: "Kotchandpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "maheshpur",
              name: Object.freeze({
                bn: "মহেশপুর",
                en: "Maheshpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "shailkupa",
              name: Object.freeze({
                bn: "শৈলকুপা",
                en: "Shailkupa",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "khulna",
          name: Object.freeze({
            bn: "খুলনা",
            en: "Khulna",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "batiaghata",
              name: Object.freeze({
                bn: "বটিয়াঘাটা",
                en: "Batiaghata",
              }),
            }),
            Object.freeze({
              upazilaKey: "dacope",
              name: Object.freeze({
                bn: "দাকোপ",
                en: "Dacope",
              }),
            }),
            Object.freeze({
              upazilaKey: "dighalia",
              name: Object.freeze({
                bn: "কাঠালিয়া",
                en: "Dighalia",
              }),
            }),
            Object.freeze({
              upazilaKey: "dumuria",
              name: Object.freeze({
                bn: "ডুমুরিয়া",
                en: "Dumuria",
              }),
            }),
            Object.freeze({
              upazilaKey: "koyra",
              name: Object.freeze({
                bn: "কয়রা",
                en: "Koyra",
              }),
            }),
            Object.freeze({
              upazilaKey: "paikgachha",
              name: Object.freeze({
                bn: "চৌগাছা",
                en: "Paikgachha",
              }),
            }),
            Object.freeze({
              upazilaKey: "phultala",
              name: Object.freeze({
                bn: "ফুলতলা",
                en: "Phultala",
              }),
            }),
            Object.freeze({
              upazilaKey: "rupsa",
              name: Object.freeze({
                bn: "রূপসা",
                en: "Rupsa",
              }),
            }),
            Object.freeze({
              upazilaKey: "terokhada",
              name: Object.freeze({
                bn: "তেরখাদা",
                en: "Terokhada",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "kushtia",
          name: Object.freeze({
            bn: "কুষ্টিয়া",
            en: "Kushtia",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bheramara",
              name: Object.freeze({
                bn: "ভেড়ামারা",
                en: "Bheramara",
              }),
            }),
            Object.freeze({
              upazilaKey: "daulatpur",
              name: Object.freeze({
                bn: "দৌলতপুর",
                en: "Daulatpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "khoksa",
              name: Object.freeze({
                bn: "খোকসা",
                en: "Khoksa",
              }),
            }),
            Object.freeze({
              upazilaKey: "kumarkhali",
              name: Object.freeze({
                bn: "কুমারখালী",
                en: "Kumarkhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "kushtia-sadar",
              name: Object.freeze({
                bn: "কুষ্টিয়া সদর",
                en: "Kushtia Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "mirpur",
              name: Object.freeze({
                bn: "মিরপুর",
                en: "Mirpur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "magura",
          name: Object.freeze({
            bn: "মাগুরা",
            en: "Magura",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "magura-sadar",
              name: Object.freeze({
                bn: "মাগুরা সদর",
                en: "Magura Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "mohammadpur",
              name: Object.freeze({
                bn: "মহম্মদপুর",
                en: "Mohammadpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "shalikha",
              name: Object.freeze({
                bn: "শালিখা",
                en: "Shalikha",
              }),
            }),
            Object.freeze({
              upazilaKey: "sreepur",
              name: Object.freeze({
                bn: "শ্রীপুর",
                en: "Sreepur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "meherpur",
          name: Object.freeze({
            bn: "মেহেরপুর",
            en: "Meherpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "gangni",
              name: Object.freeze({
                bn: "গাংনী",
                en: "Gangni",
              }),
            }),
            Object.freeze({
              upazilaKey: "meherpur-sadar",
              name: Object.freeze({
                bn: "মেহেরপুর সদর",
                en: "Meherpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "mujibnagar",
              name: Object.freeze({
                bn: "মুজিবনগর",
                en: "Mujibnagar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "narail",
          name: Object.freeze({
            bn: "নড়াইল",
            en: "Narail",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "kalia",
              name: Object.freeze({
                bn: "কালিয়া",
                en: "Kalia",
              }),
            }),
            Object.freeze({
              upazilaKey: "lohagara",
              name: Object.freeze({
                bn: "লোহাগড়া",
                en: "Lohagara",
              }),
            }),
            Object.freeze({
              upazilaKey: "narail-sadar",
              name: Object.freeze({
                bn: "নড়াইল সদর",
                en: "Narail Sadar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "satkhira",
          name: Object.freeze({
            bn: "সাতক্ষীরা",
            en: "Satkhira",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "ashashuni",
              name: Object.freeze({
                bn: "আশাশুনি",
                en: "Ashashuni",
              }),
            }),
            Object.freeze({
              upazilaKey: "debhata",
              name: Object.freeze({
                bn: "দেবহাটা",
                en: "Debhata",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalaroa",
              name: Object.freeze({
                bn: "কলারোয়া",
                en: "Kalaroa",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaliganj",
              name: Object.freeze({
                bn: "কালীগঞ্জ",
                en: "Kaliganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "satkhira-sadar",
              name: Object.freeze({
                bn: "সাতক্ষীরা সদর",
                en: "Satkhira Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "shyamnagar",
              name: Object.freeze({
                bn: "শ্যামনগর",
                en: "Shyamnagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "tala",
              name: Object.freeze({
                bn: "তালা",
                en: "Tala",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "mymensingh",
      name: Object.freeze({
        bn: "ময়মনসিংহ",
        en: "Mymensingh",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "jamalpur",
          name: Object.freeze({
            bn: "জামালপুর",
            en: "Jamalpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bakshiganj",
              name: Object.freeze({
                bn: "বকশীগঞ্জ",
                en: "Bakshiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "dewanganj",
              name: Object.freeze({
                bn: "দেওয়ানগঞ্জ",
                en: "Dewanganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "islampur",
              name: Object.freeze({
                bn: "ইসলামপুর",
                en: "Islampur",
              }),
            }),
            Object.freeze({
              upazilaKey: "jamalpur-sadar",
              name: Object.freeze({
                bn: "জামালপুর সদর",
                en: "Jamalpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "madarganj",
              name: Object.freeze({
                bn: "মাদারগঞ্জ",
                en: "Madarganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "melandaha",
              name: Object.freeze({
                bn: "মেলান্দহ",
                en: "Melandaha",
              }),
            }),
            Object.freeze({
              upazilaKey: "sarishabari",
              name: Object.freeze({
                bn: "সরিষাবাড়ী",
                en: "Sarishabari",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "mymensingh",
          name: Object.freeze({
            bn: "ময়মনসিংহ",
            en: "Mymensingh",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bhaluka",
              name: Object.freeze({
                bn: "ভালুকা",
                en: "Bhaluka",
              }),
            }),
            Object.freeze({
              upazilaKey: "dhobaura",
              name: Object.freeze({
                bn: "ধোবাউড়া",
                en: "Dhobaura",
              }),
            }),
            Object.freeze({
              upazilaKey: "fulbaria",
              name: Object.freeze({
                bn: "ফুলবাড়ীয়া",
                en: "Fulbaria",
              }),
            }),
            Object.freeze({
              upazilaKey: "fulpur",
              name: Object.freeze({
                bn: "ফুলপুর",
                en: "Fulpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "gafargaon",
              name: Object.freeze({
                bn: "গফরগাঁও",
                en: "Gafargaon",
              }),
            }),
            Object.freeze({
              upazilaKey: "gouripur",
              name: Object.freeze({
                bn: "গৌরীপুর",
                en: "Gouripur",
              }),
            }),
            Object.freeze({
              upazilaKey: "haluaghat",
              name: Object.freeze({
                bn: "হালুয়াঘাট",
                en: "Haluaghat",
              }),
            }),
            Object.freeze({
              upazilaKey: "ishwarganj",
              name: Object.freeze({
                bn: "ঈশ্বরগঞ্জ",
                en: "Ishwarganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "muktagachha",
              name: Object.freeze({
                bn: "মুক্তাগাছা",
                en: "Muktagachha",
              }),
            }),
            Object.freeze({
              upazilaKey: "mymensingh-sadar",
              name: Object.freeze({
                bn: "ময়মনসিংহ সদর",
                en: "Mymensingh Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "nandail",
              name: Object.freeze({
                bn: "নান্দাইল",
                en: "Nandail",
              }),
            }),
            Object.freeze({
              upazilaKey: "tarakanda",
              name: Object.freeze({
                bn: "তারাকান্দা",
                en: "Tarakanda",
              }),
            }),
            Object.freeze({
              upazilaKey: "trishal",
              name: Object.freeze({
                bn: "ত্রিশাল",
                en: "Trishal",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "netrakona",
          name: Object.freeze({
            bn: "নেত্রকোনা",
            en: "Netrakona",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "atpara",
              name: Object.freeze({
                bn: "আটপাড়া",
                en: "Atpara",
              }),
            }),
            Object.freeze({
              upazilaKey: "barhatta",
              name: Object.freeze({
                bn: "বারহাট্টা",
                en: "Barhatta",
              }),
            }),
            Object.freeze({
              upazilaKey: "durgapur",
              name: Object.freeze({
                bn: "দুর্গাপুর",
                en: "Durgapur",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalmakanda",
              name: Object.freeze({
                bn: "কলমাকান্দা",
                en: "Kalmakanda",
              }),
            }),
            Object.freeze({
              upazilaKey: "kendua",
              name: Object.freeze({
                bn: "কেন্দুয়া",
                en: "Kendua",
              }),
            }),
            Object.freeze({
              upazilaKey: "khaliajuri",
              name: Object.freeze({
                bn: "খালিয়াজুরী",
                en: "Khaliajuri",
              }),
            }),
            Object.freeze({
              upazilaKey: "madan",
              name: Object.freeze({
                bn: "মদন",
                en: "Madan",
              }),
            }),
            Object.freeze({
              upazilaKey: "mohanganj",
              name: Object.freeze({
                bn: "মোহনগঞ্জ",
                en: "Mohanganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "netrakona-sadar",
              name: Object.freeze({
                bn: "নেত্রকোণা সদর",
                en: "Netrakona Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "purbadhala",
              name: Object.freeze({
                bn: "পূর্বধলা",
                en: "Purbadhala",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "sherpur",
          name: Object.freeze({
            bn: "শেরপুর",
            en: "Sherpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "jhenaigati",
              name: Object.freeze({
                bn: "ঝিনাইগাতী",
                en: "Jhenaigati",
              }),
            }),
            Object.freeze({
              upazilaKey: "nakla",
              name: Object.freeze({
                bn: "নকলা",
                en: "Nakla",
              }),
            }),
            Object.freeze({
              upazilaKey: "nalitabari",
              name: Object.freeze({
                bn: "নালিতাবাড়ী",
                en: "Nalitabari",
              }),
            }),
            Object.freeze({
              upazilaKey: "sherpur-sadar",
              name: Object.freeze({
                bn: "শেরপুর সদর",
                en: "Sherpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "sreebardi",
              name: Object.freeze({
                bn: "শ্রীবরদী",
                en: "Sreebardi",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "rajshahi",
      name: Object.freeze({
        bn: "রাজশাহী",
        en: "Rajshahi",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "bogura",
          name: Object.freeze({
            bn: "বগুড়া",
            en: "Bogura",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "adamdighi",
              name: Object.freeze({
                bn: "আদমদিঘি",
                en: "Adamdighi",
              }),
            }),
            Object.freeze({
              upazilaKey: "bogura-sadar",
              name: Object.freeze({
                bn: "মাগুরা সদর",
                en: "Bogura Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "dhunat",
              name: Object.freeze({
                bn: "ধুনট",
                en: "Dhunat",
              }),
            }),
            Object.freeze({
              upazilaKey: "dupchachia",
              name: Object.freeze({
                bn: "দুপচাঁচিয়া",
                en: "Dupchachia",
              }),
            }),
            Object.freeze({
              upazilaKey: "gabtali",
              name: Object.freeze({
                bn: "গাবতলী",
                en: "Gabtali",
              }),
            }),
            Object.freeze({
              upazilaKey: "kahaloo",
              name: Object.freeze({
                bn: "কাহালু",
                en: "Kahaloo",
              }),
            }),
            Object.freeze({
              upazilaKey: "nandigram",
              name: Object.freeze({
                bn: "নন্দিগ্রাম",
                en: "Nandigram",
              }),
            }),
            Object.freeze({
              upazilaKey: "sariakandi",
              name: Object.freeze({
                bn: "সারিয়াকান্দি",
                en: "Sariakandi",
              }),
            }),
            Object.freeze({
              upazilaKey: "shajahanpur",
              name: Object.freeze({
                bn: "শাজাহানপুর",
                en: "Shajahanpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "sherpur",
              name: Object.freeze({
                bn: "শেরপুর",
                en: "Sherpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "shibganj",
              name: Object.freeze({
                bn: "শিবগঞ্জ",
                en: "Shibganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "sonatala",
              name: Object.freeze({
                bn: "সোনাতলা",
                en: "Sonatala",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "joypurhat",
          name: Object.freeze({
            bn: "জয়পুরহাট",
            en: "Joypurhat",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "akkelpur",
              name: Object.freeze({
                bn: "আক্কেলপুর",
                en: "Akkelpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "joypurhat-sadar",
              name: Object.freeze({
                bn: "জয়পুরহাট সদর",
                en: "Joypurhat Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "kalai",
              name: Object.freeze({
                bn: "কালাই",
                en: "Kalai",
              }),
            }),
            Object.freeze({
              upazilaKey: "khetlal",
              name: Object.freeze({
                bn: "ক্ষেতলাল",
                en: "Khetlal",
              }),
            }),
            Object.freeze({
              upazilaKey: "panchbibi",
              name: Object.freeze({
                bn: "পাঁচবিবি",
                en: "Panchbibi",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "naogaon",
          name: Object.freeze({
            bn: "নওগাঁ",
            en: "Naogaon",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "atrai",
              name: Object.freeze({
                bn: "আত্রাই",
                en: "Atrai",
              }),
            }),
            Object.freeze({
              upazilaKey: "badalgachhi",
              name: Object.freeze({
                bn: "বদলগাছী",
                en: "Badalgachhi",
              }),
            }),
            Object.freeze({
              upazilaKey: "dhamoirhat",
              name: Object.freeze({
                bn: "ধামইরহাট",
                en: "Dhamoirhat",
              }),
            }),
            Object.freeze({
              upazilaKey: "mahadebpur",
              name: Object.freeze({
                bn: "মহাদেবপুর",
                en: "Mahadebpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "manda",
              name: Object.freeze({
                bn: "মান্দা",
                en: "Manda",
              }),
            }),
            Object.freeze({
              upazilaKey: "naogaon-sadar",
              name: Object.freeze({
                bn: "নওগাঁ সদর",
                en: "Naogaon Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "niamatpur",
              name: Object.freeze({
                bn: "নিয়ামতপুর",
                en: "Niamatpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "patnitala",
              name: Object.freeze({
                bn: "পত্নিতলা",
                en: "Patnitala",
              }),
            }),
            Object.freeze({
              upazilaKey: "porsha",
              name: Object.freeze({
                bn: "পোরশা",
                en: "Porsha",
              }),
            }),
            Object.freeze({
              upazilaKey: "raninagar",
              name: Object.freeze({
                bn: "রাণীনগর",
                en: "Raninagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "sapahar",
              name: Object.freeze({
                bn: "সাপাহার",
                en: "Sapahar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "natore",
          name: Object.freeze({
            bn: "নাটোর",
            en: "Natore",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bagatipara",
              name: Object.freeze({
                bn: "বাগাতিপাড়া",
                en: "Bagatipara",
              }),
            }),
            Object.freeze({
              upazilaKey: "baraigram",
              name: Object.freeze({
                bn: "বড়াইগ্রাম",
                en: "Baraigram",
              }),
            }),
            Object.freeze({
              upazilaKey: "gurudaspur",
              name: Object.freeze({
                bn: "গুরুদাসপুর",
                en: "Gurudaspur",
              }),
            }),
            Object.freeze({
              upazilaKey: "lalpur",
              name: Object.freeze({
                bn: "লালপুর",
                en: "Lalpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "naldanga",
              name: Object.freeze({
                bn: "নলডাঙ্গা",
                en: "Naldanga",
              }),
            }),
            Object.freeze({
              upazilaKey: "natore-sadar",
              name: Object.freeze({
                bn: "নাটোর সদর",
                en: "Natore Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "singra",
              name: Object.freeze({
                bn: "সিংড়া",
                en: "Singra",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "chapainababganj",
          name: Object.freeze({
            bn: "চাঁপাইনবাবগঞ্জ",
            en: "Chapainababganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bholahat",
              name: Object.freeze({
                bn: "ভোলাহাট",
                en: "Bholahat",
              }),
            }),
            Object.freeze({
              upazilaKey: "chapainawabganj-sadar",
              name: Object.freeze({
                bn: "চাঁপাইনবাবগঞ্জ সদর",
                en: "Chapainawabganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "gomastapur",
              name: Object.freeze({
                bn: "গোমস্তাপুর",
                en: "Gomastapur",
              }),
            }),
            Object.freeze({
              upazilaKey: "nachole",
              name: Object.freeze({
                bn: "নাচোল",
                en: "Nachole",
              }),
            }),
            Object.freeze({
              upazilaKey: "shibganj",
              name: Object.freeze({
                bn: "শিবগঞ্জ",
                en: "Shibganj",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "pabna",
          name: Object.freeze({
            bn: "পাবনা",
            en: "Pabna",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "atgharia",
              name: Object.freeze({
                bn: "আটঘরিয়া",
                en: "Atgharia",
              }),
            }),
            Object.freeze({
              upazilaKey: "bera",
              name: Object.freeze({
                bn: "বেড়া",
                en: "Bera",
              }),
            }),
            Object.freeze({
              upazilaKey: "bhangura",
              name: Object.freeze({
                bn: "ভাঙ্গুড়া",
                en: "Bhangura",
              }),
            }),
            Object.freeze({
              upazilaKey: "chatmohar",
              name: Object.freeze({
                bn: "চাটমোহর",
                en: "Chatmohar",
              }),
            }),
            Object.freeze({
              upazilaKey: "faridpur",
              name: Object.freeze({
                bn: "ফরিদপুর",
                en: "Faridpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "ishwardi",
              name: Object.freeze({
                bn: "ঈশ্বরদী",
                en: "Ishwardi",
              }),
            }),
            Object.freeze({
              upazilaKey: "pabna-sadar",
              name: Object.freeze({
                bn: "পাবনা সদর",
                en: "Pabna Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "santhia",
              name: Object.freeze({
                bn: "সাঁথিয়া",
                en: "Santhia",
              }),
            }),
            Object.freeze({
              upazilaKey: "sujanagar",
              name: Object.freeze({
                bn: "সুজানগর",
                en: "Sujanagar",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "rajshahi",
          name: Object.freeze({
            bn: "রাজশাহী",
            en: "Rajshahi",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bagha",
              name: Object.freeze({
                bn: "বাঘা",
                en: "Bagha",
              }),
            }),
            Object.freeze({
              upazilaKey: "bagmara",
              name: Object.freeze({
                bn: "বাগমারা",
                en: "Bagmara",
              }),
            }),
            Object.freeze({
              upazilaKey: "charghat",
              name: Object.freeze({
                bn: "চারঘাট",
                en: "Charghat",
              }),
            }),
            Object.freeze({
              upazilaKey: "durgapur",
              name: Object.freeze({
                bn: "দুর্গাপুর",
                en: "Durgapur",
              }),
            }),
            Object.freeze({
              upazilaKey: "godagari",
              name: Object.freeze({
                bn: "গোদাগাড়ী",
                en: "Godagari",
              }),
            }),
            Object.freeze({
              upazilaKey: "mohanpur",
              name: Object.freeze({
                bn: "লালমোহন",
                en: "Mohanpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "paba",
              name: Object.freeze({
                bn: "পবা",
                en: "Paba",
              }),
            }),
            Object.freeze({
              upazilaKey: "puthia",
              name: Object.freeze({
                bn: "পুঠিয়া",
                en: "Puthia",
              }),
            }),
            Object.freeze({
              upazilaKey: "tanore",
              name: Object.freeze({
                bn: "তানোর",
                en: "Tanore",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "sirajganj",
          name: Object.freeze({
            bn: "সিরাজগঞ্জ",
            en: "Sirajganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "belkuchi",
              name: Object.freeze({
                bn: "বেলকুচি",
                en: "Belkuchi",
              }),
            }),
            Object.freeze({
              upazilaKey: "chouhali",
              name: Object.freeze({
                bn: "চৌহালি",
                en: "Chouhali",
              }),
            }),
            Object.freeze({
              upazilaKey: "kamarkhanda",
              name: Object.freeze({
                bn: "কামারখন্দ",
                en: "Kamarkhanda",
              }),
            }),
            Object.freeze({
              upazilaKey: "kazipur",
              name: Object.freeze({
                bn: "কাজীপুর",
                en: "Kazipur",
              }),
            }),
            Object.freeze({
              upazilaKey: "rayganj",
              name: Object.freeze({
                bn: "রায়গঞ্জ",
                en: "Rayganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "shahjadpur",
              name: Object.freeze({
                bn: "শাহজাদপুর",
                en: "Shahjadpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "sirajganj-sadar",
              name: Object.freeze({
                bn: "সিরাজগঞ্জ সদর",
                en: "Sirajganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "tarash",
              name: Object.freeze({
                bn: "তাড়াশ",
                en: "Tarash",
              }),
            }),
            Object.freeze({
              upazilaKey: "ullapara",
              name: Object.freeze({
                bn: "উল্লাপাড়া",
                en: "Ullapara",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "rangpur",
      name: Object.freeze({
        bn: "রংপুর",
        en: "Rangpur",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "dinajpur",
          name: Object.freeze({
            bn: "দিনাজপুর",
            en: "Dinajpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "birampur",
              name: Object.freeze({
                bn: "বিরামপুর",
                en: "Birampur",
              }),
            }),
            Object.freeze({
              upazilaKey: "birganj",
              name: Object.freeze({
                bn: "বীরগঞ্জ",
                en: "Birganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "birol",
              name: Object.freeze({
                bn: "বিরল",
                en: "Birol",
              }),
            }),
            Object.freeze({
              upazilaKey: "bochaganj",
              name: Object.freeze({
                bn: "বোচাগঞ্জ",
                en: "Bochaganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "chirirbandar",
              name: Object.freeze({
                bn: "চিরিরবন্দর",
                en: "Chirirbandar",
              }),
            }),
            Object.freeze({
              upazilaKey: "dinajpur-sadar",
              name: Object.freeze({
                bn: "দিনাজপুর সদর",
                en: "Dinajpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "fulbari",
              name: Object.freeze({
                bn: "ফুলবাড়ী",
                en: "Fulbari",
              }),
            }),
            Object.freeze({
              upazilaKey: "ghoraghat",
              name: Object.freeze({
                bn: "ঘোড়াঘাট",
                en: "Ghoraghat",
              }),
            }),
            Object.freeze({
              upazilaKey: "hakimpur",
              name: Object.freeze({
                bn: "হাকিমপুর",
                en: "Hakimpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaharole",
              name: Object.freeze({
                bn: "কাহারোল",
                en: "Kaharole",
              }),
            }),
            Object.freeze({
              upazilaKey: "khansama",
              name: Object.freeze({
                bn: "খানসামা",
                en: "Khansama",
              }),
            }),
            Object.freeze({
              upazilaKey: "nababganj",
              name: Object.freeze({
                bn: "নবাবগঞ্জ",
                en: "Nababganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "parbatipur",
              name: Object.freeze({
                bn: "পার্বতীপুর",
                en: "Parbatipur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "gaibandha",
          name: Object.freeze({
            bn: "গাইবান্ধা",
            en: "Gaibandha",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "fulchhari",
              name: Object.freeze({
                bn: "ফুলছড়ি",
                en: "Fulchhari",
              }),
            }),
            Object.freeze({
              upazilaKey: "gaibandha-sadar",
              name: Object.freeze({
                bn: "গাইবান্ধা সদর",
                en: "Gaibandha Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "gobindaganj",
              name: Object.freeze({
                bn: "গোবিন্দগঞ্জ",
                en: "Gobindaganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "palashbari",
              name: Object.freeze({
                bn: "পলাশবাড়ী",
                en: "Palashbari",
              }),
            }),
            Object.freeze({
              upazilaKey: "sadullapur",
              name: Object.freeze({
                bn: "সাদুল্লাপুর",
                en: "Sadullapur",
              }),
            }),
            Object.freeze({
              upazilaKey: "saghata",
              name: Object.freeze({
                bn: "সাঘাটা",
                en: "Saghata",
              }),
            }),
            Object.freeze({
              upazilaKey: "sundarganj",
              name: Object.freeze({
                bn: "সুন্দরগঞ্জ",
                en: "Sundarganj",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "kurigram",
          name: Object.freeze({
            bn: "কুড়িগ্রাম",
            en: "Kurigram",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bhurungamari",
              name: Object.freeze({
                bn: "ভুরুঙ্গামারী",
                en: "Bhurungamari",
              }),
            }),
            Object.freeze({
              upazilaKey: "chilmari",
              name: Object.freeze({
                bn: "চিলমারী",
                en: "Chilmari",
              }),
            }),
            Object.freeze({
              upazilaKey: "kurigram-sadar",
              name: Object.freeze({
                bn: "কুড়িগ্রাম সদর",
                en: "Kurigram Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "nageshwari",
              name: Object.freeze({
                bn: "নাগেশ্বরী",
                en: "Nageshwari",
              }),
            }),
            Object.freeze({
              upazilaKey: "phulbari",
              name: Object.freeze({
                bn: "ফুলবাড়ী",
                en: "Phulbari",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajarhat",
              name: Object.freeze({
                bn: "রাজারহাট",
                en: "Rajarhat",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajibpur",
              name: Object.freeze({
                bn: "চর রাজিবপুর",
                en: "Rajibpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "roumari",
              name: Object.freeze({
                bn: "রৌমারী",
                en: "Roumari",
              }),
            }),
            Object.freeze({
              upazilaKey: "ulipur",
              name: Object.freeze({
                bn: "উলিপুর",
                en: "Ulipur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "lalmonirhat",
          name: Object.freeze({
            bn: "লালমনিরহাট",
            en: "Lalmonirhat",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "aditmari",
              name: Object.freeze({
                bn: "আদিতমারী",
                en: "Aditmari",
              }),
            }),
            Object.freeze({
              upazilaKey: "hatibandha",
              name: Object.freeze({
                bn: "হাতীবান্ধা",
                en: "Hatibandha",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaliganj",
              name: Object.freeze({
                bn: "কালীগঞ্জ",
                en: "Kaliganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "lalmonirhat-sadar",
              name: Object.freeze({
                bn: "লালমনিরহাট সদর",
                en: "Lalmonirhat Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "patgram",
              name: Object.freeze({
                bn: "পাটগ্রাম",
                en: "Patgram",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "nilphamari",
          name: Object.freeze({
            bn: "নীলফামারী",
            en: "Nilphamari",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "dimla",
              name: Object.freeze({
                bn: "ডিমলা",
                en: "Dimla",
              }),
            }),
            Object.freeze({
              upazilaKey: "domar",
              name: Object.freeze({
                bn: "ডোমার",
                en: "Domar",
              }),
            }),
            Object.freeze({
              upazilaKey: "jaldhaka",
              name: Object.freeze({
                bn: "জলঢাকা",
                en: "Jaldhaka",
              }),
            }),
            Object.freeze({
              upazilaKey: "kishoreganj",
              name: Object.freeze({
                bn: "কিশোরগঞ্জ সদর",
                en: "Kishoreganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "nilphamari-sadar",
              name: Object.freeze({
                bn: "নীলফামারী সদর",
                en: "Nilphamari Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "saidpur",
              name: Object.freeze({
                bn: "ফরিদপুর",
                en: "Saidpur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "panchagarh",
          name: Object.freeze({
            bn: "পঞ্চগড়",
            en: "Panchagarh",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "atowari",
              name: Object.freeze({
                bn: "আটোয়ারী",
                en: "Atowari",
              }),
            }),
            Object.freeze({
              upazilaKey: "boda",
              name: Object.freeze({
                bn: "বোদা",
                en: "Boda",
              }),
            }),
            Object.freeze({
              upazilaKey: "debiganj",
              name: Object.freeze({
                bn: "দেবীগঞ্জ",
                en: "Debiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "panchagarh-sadar",
              name: Object.freeze({
                bn: "পঞ্চগড় সদর",
                en: "Panchagarh Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "tetulia",
              name: Object.freeze({
                bn: "তেতুলিয়া",
                en: "Tetulia",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "rangpur",
          name: Object.freeze({
            bn: "রংপুর",
            en: "Rangpur",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "badarganj",
              name: Object.freeze({
                bn: "মাদারগঞ্জ",
                en: "Badarganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "gangachara",
              name: Object.freeze({
                bn: "গংগাচড়া",
                en: "Gangachara",
              }),
            }),
            Object.freeze({
              upazilaKey: "kaunia",
              name: Object.freeze({
                bn: "কাউনিয়া",
                en: "Kaunia",
              }),
            }),
            Object.freeze({
              upazilaKey: "mithapukur",
              name: Object.freeze({
                bn: "মিঠাপুকুর",
                en: "Mithapukur",
              }),
            }),
            Object.freeze({
              upazilaKey: "pirgachha",
              name: Object.freeze({
                bn: "পীরগাছা",
                en: "Pirgachha",
              }),
            }),
            Object.freeze({
              upazilaKey: "pirganj",
              name: Object.freeze({
                bn: "পীরগঞ্জ",
                en: "Pirganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "rangpur-sadar",
              name: Object.freeze({
                bn: "রংপুর সদর",
                en: "Rangpur Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "taraganj",
              name: Object.freeze({
                bn: "বালাগঞ্জ",
                en: "Taraganj",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "thakurgaon",
          name: Object.freeze({
            bn: "ঠাকুরগাঁও",
            en: "Thakurgaon",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "baliadangi",
              name: Object.freeze({
                bn: "বালিয়াডাঙ্গী",
                en: "Baliadangi",
              }),
            }),
            Object.freeze({
              upazilaKey: "haripur",
              name: Object.freeze({
                bn: "হরিপুর",
                en: "Haripur",
              }),
            }),
            Object.freeze({
              upazilaKey: "pirganj",
              name: Object.freeze({
                bn: "পীরগঞ্জ",
                en: "Pirganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "ranishankail",
              name: Object.freeze({
                bn: "রাণীশংকৈল",
                en: "Ranishankail",
              }),
            }),
            Object.freeze({
              upazilaKey: "thakurgaon-sadar",
              name: Object.freeze({
                bn: "ঠাকুরগাঁও সদর",
                en: "Thakurgaon Sadar",
              }),
            }),
          ]),
        }),
      ]),
    }),
    Object.freeze({
      divisionKey: "sylhet",
      name: Object.freeze({
        bn: "সিলেট",
        en: "Sylhet",
      }),
      districts: Object.freeze([
        Object.freeze({
          districtKey: "habiganj",
          name: Object.freeze({
            bn: "হবিগঞ্জ",
            en: "Habiganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "ajmiriganj",
              name: Object.freeze({
                bn: "আজমিরীগঞ্জ",
                en: "Ajmiriganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "bahubal",
              name: Object.freeze({
                bn: "বাহুবল",
                en: "Bahubal",
              }),
            }),
            Object.freeze({
              upazilaKey: "baniachong",
              name: Object.freeze({
                bn: "বানিয়াচং",
                en: "Baniachong",
              }),
            }),
            Object.freeze({
              upazilaKey: "chunarughat",
              name: Object.freeze({
                bn: "চুনারুঘাট",
                en: "Chunarughat",
              }),
            }),
            Object.freeze({
              upazilaKey: "habiganj-sadar",
              name: Object.freeze({
                bn: "হবিগঞ্জ সদর",
                en: "Habiganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "lakhai",
              name: Object.freeze({
                bn: "লাখাই",
                en: "Lakhai",
              }),
            }),
            Object.freeze({
              upazilaKey: "madhabpur",
              name: Object.freeze({
                bn: "মাধবপুর",
                en: "Madhabpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "nabiganj",
              name: Object.freeze({
                bn: "নবীগঞ্জ",
                en: "Nabiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "shayestaganj",
              name: Object.freeze({
                bn: "শায়েস্তাগঞ্জ",
                en: "Shayestaganj",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "moulvibazar",
          name: Object.freeze({
            bn: "মৌলভীবাজার",
            en: "Moulvibazar",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "baralekha",
              name: Object.freeze({
                bn: "বড়লেখা",
                en: "Baralekha",
              }),
            }),
            Object.freeze({
              upazilaKey: "juri",
              name: Object.freeze({
                bn: "জুড়ী",
                en: "Juri",
              }),
            }),
            Object.freeze({
              upazilaKey: "kamalganj",
              name: Object.freeze({
                bn: "জামালগঞ্জ",
                en: "Kamalganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "kulaura",
              name: Object.freeze({
                bn: "কুলাউড়া",
                en: "Kulaura",
              }),
            }),
            Object.freeze({
              upazilaKey: "moulvibazar-sadar",
              name: Object.freeze({
                bn: "মৌলভীবাজার সদর",
                en: "Moulvibazar Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "rajnagar",
              name: Object.freeze({
                bn: "রাজনগর",
                en: "Rajnagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "sreemangal",
              name: Object.freeze({
                bn: "শ্রীমঙ্গল",
                en: "Sreemangal",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "sunamganj",
          name: Object.freeze({
            bn: "সুনামগঞ্জ",
            en: "Sunamganj",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "bishwambharpur",
              name: Object.freeze({
                bn: "বিশ্বম্ভরপুর",
                en: "Bishwambharpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "chhatak",
              name: Object.freeze({
                bn: "ছাতক",
                en: "Chhatak",
              }),
            }),
            Object.freeze({
              upazilaKey: "derai",
              name: Object.freeze({
                bn: "দিরাই",
                en: "Derai",
              }),
            }),
            Object.freeze({
              upazilaKey: "dharmapasha",
              name: Object.freeze({
                bn: "ধর্মপাশা",
                en: "Dharmapasha",
              }),
            }),
            Object.freeze({
              upazilaKey: "dowarabazar",
              name: Object.freeze({
                bn: "দোয়ারাবাজার",
                en: "Dowarabazar",
              }),
            }),
            Object.freeze({
              upazilaKey: "jagannathpur",
              name: Object.freeze({
                bn: "জগন্নাথপুর",
                en: "Jagannathpur",
              }),
            }),
            Object.freeze({
              upazilaKey: "jamalganj",
              name: Object.freeze({
                bn: "জামালগঞ্জ",
                en: "Jamalganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "madhyanagar",
              name: Object.freeze({
                bn: "মধ্যনগর",
                en: "Madhyanagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "shalla",
              name: Object.freeze({
                bn: "শাল্লা",
                en: "Shalla",
              }),
            }),
            Object.freeze({
              upazilaKey: "shantiganj",
              name: Object.freeze({
                bn: "শান্তিগঞ্জ",
                en: "Shantiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "sunamganj-sadar",
              name: Object.freeze({
                bn: "সুনামগঞ্জ সদর",
                en: "Sunamganj Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "tahirpur",
              name: Object.freeze({
                bn: "তাহিরপুর",
                en: "Tahirpur",
              }),
            }),
          ]),
        }),
        Object.freeze({
          districtKey: "sylhet",
          name: Object.freeze({
            bn: "সিলেট",
            en: "Sylhet",
          }),
          upazilas: Object.freeze([
            Object.freeze({
              upazilaKey: "balaganj",
              name: Object.freeze({
                bn: "বালাগঞ্জ",
                en: "Balaganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "beanibazar",
              name: Object.freeze({
                bn: "বিয়ানীবাজার",
                en: "Beanibazar",
              }),
            }),
            Object.freeze({
              upazilaKey: "bishwanath",
              name: Object.freeze({
                bn: "বিশ্বনাথ",
                en: "Bishwanath",
              }),
            }),
            Object.freeze({
              upazilaKey: "companiganj",
              name: Object.freeze({
                bn: "কোম্পানীগঞ্জ",
                en: "Companiganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "dakkhin-surma",
              name: Object.freeze({
                bn: "দক্ষিণ সুরমা",
                en: "Dakkhin Surma",
              }),
            }),
            Object.freeze({
              upazilaKey: "fenchuganj",
              name: Object.freeze({
                bn: "ফেঞ্চুগঞ্জ",
                en: "Fenchuganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "golapganj",
              name: Object.freeze({
                bn: "গোলাপগঞ্জ",
                en: "Golapganj",
              }),
            }),
            Object.freeze({
              upazilaKey: "gowainghat",
              name: Object.freeze({
                bn: "গোয়াইনঘাট",
                en: "Gowainghat",
              }),
            }),
            Object.freeze({
              upazilaKey: "jaintapur",
              name: Object.freeze({
                bn: "জৈন্তাপুর",
                en: "Jaintapur",
              }),
            }),
            Object.freeze({
              upazilaKey: "kanaighat",
              name: Object.freeze({
                bn: "কানাইঘাট",
                en: "Kanaighat",
              }),
            }),
            Object.freeze({
              upazilaKey: "osmaninagar",
              name: Object.freeze({
                bn: "ওসমানী নগর",
                en: "Osmaninagar",
              }),
            }),
            Object.freeze({
              upazilaKey: "sylhet-sadar",
              name: Object.freeze({
                bn: "সিলেট সদর",
                en: "Sylhet Sadar",
              }),
            }),
            Object.freeze({
              upazilaKey: "zakiganj",
              name: Object.freeze({
                bn: "জকিগঞ্জ",
                en: "Zakiganj",
              }),
            }),
          ]),
        }),
      ]),
    }),
  ]) as readonly GeoBdDivision[],
);
