const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'store.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// All prices in Indian Rupees (INR)
const SEED_PRODUCTS = [
  {
    slug: 'chrono-01-automatic-dress-watch',
    name: 'Chrono-01 Automatic Watch',
    category: 'Timepieces',
    price: 145000,
    rating: 5.0,
    reviews_count: 38,
    stock: 5,
    image_url: '/images/watch.jpg',
    short_description: 'Grade-5 brushed titanium automatic timepiece with obsidian dial and hand-stitched leather strap.',
    description: 'Assembled in numbered batches of 250, the Chrono-01 pairs a razor-thin Grade-5 brushed titanium case with an anti-reflective sapphire crystal, champagne-gold baton indices, and a 72-hour Swiss automatic movement.',
    specs: ['Grade-5 Brushed Titanium (39mm)', '72-Hour Automatic Calibre', 'Domed Sapphire Crystal (AR Coated)', 'Hand-Stitched Alligator-Grain Strap'],
    featured: 1
  },
  {
    slug: 'studio-reference-anc-headphones',
    name: 'Studio Reference ANC',
    category: 'Audio',
    price: 34900,
    rating: 4.9,
    reviews_count: 164,
    stock: 16,
    image_url: '/images/headphones.jpg',
    short_description: 'Adaptive acoustic noise-cancelling over-ear headphones with 42-hour battery reserve.',
    description: 'Engineered with custom 40mm beryllium-coated drivers and studio-calibrated adaptive noise cancellation. Wrapped in supple lambskin memory foam cushions for effortless long-haul listening.',
    specs: ['40mm Reference Acoustic Drivers', 'Adaptive ANC + Ambient Mode', '42-Hour Battery & USB-C Lossless', 'Bluetooth 5.3 Multipoint Pairing'],
    featured: 1
  },
  {
    slug: 'florentine-leather-daypack',
    name: 'Florentine Leather Daypack',
    category: 'Carry',
    price: 28900,
    rating: 4.8,
    reviews_count: 89,
    stock: 9,
    image_url: '/images/leather-daypack.jpg',
    short_description: 'Vegetable-tanned full-grain cognac leather backpack with suspended 16-inch laptop vault.',
    description: 'Cut from full-grain vegetable-tanned hides that deepen into a lustrous patina with every journey. Outfitted with solid brushed-brass YKK Excella zippers and a suede-lined 16-inch laptop compartment.',
    specs: ['18L Architectural Silhouette', 'Full-Grain Vegetable-Tanned Hide', 'Solid Brushed Brass YKK Zippers', 'Suede-Lined 16" Laptop Sleeve'],
    featured: 1
  },
  {
    slug: 'tactile-cnc-mechanical-keyboard',
    name: 'Atelier 75% CNC Keyboard',
    category: 'Workspace',
    price: 24500,
    rating: 4.9,
    reviews_count: 112,
    stock: 14,
    image_url: '/images/keyboard.jpg',
    short_description: 'Bead-blasted CNC aluminum 75% wireless mechanical keyboard with pre-lubed tactile switches.',
    description: 'Milled from a solid billet of 6063 aerospace aluminum with an internal brass acoustic weight. Gasket-mounted for a refined, hushed keystroke across macOS and Windows workstations.',
    specs: ['6063 CNC Aluminum + Brass Weight', 'Gasket-Mounted Acoustic Profile', 'Hot-Swap Pre-Lubed Switches', 'Tri-Mode: USB-C, 2.4GHz, Bluetooth'],
    featured: 1
  },
  {
    slug: 'noir-oud-hinoki-diffuser',
    name: 'Noir Oud & Hinoki Diffuser',
    category: 'Home',
    price: 18500,
    rating: 4.9,
    reviews_count: 74,
    stock: 19,
    image_url: '/images/diffuser.jpg',
    short_description: 'Mouth-blown smoked amber vessel with solid brushed brass collar and rare Assam oud blend.',
    description: 'Formulated in Grasse with aged Assam oud, Japanese Hinoki cypress, and smoked vetiver. Housed in a heavy hand-blown amber glass sphere crowned with a lathe-turned solid brass collar.',
    specs: ['350ml Fine Botanical Oil Blend', 'Mouth-Blown Smoked Amber Glass', 'Solid Lathe-Turned Brass Collar', '6-Month Continuous Scent Throw'],
    featured: 1
  },
  {
    slug: 'cantilever-brass-desk-lamp',
    name: 'Cantilever Brass Desk Lamp',
    category: 'Workspace',
    price: 16800,
    rating: 4.8,
    reviews_count: 61,
    stock: 18,
    image_url: '/images/desk-lamp.jpg',
    short_description: 'Counterweighted architectural task lamp in powder-coated matte black and solid brushed brass.',
    description: 'Sculptural cantilevered geometry engineered with precision solid-brass pivot joints. Emits museum-grade 97+ CRI flicker-free illumination with seamless touch dimming from warm candlelight to crisp daylight.',
    specs: ['97+ CRI Museum-Grade LED', 'Stepless 2700K–5000K Touch Dimmer', 'Solid Brushed Brass Pivot Joints', 'Weighted Monolithic Aluminum Base'],
    featured: 0
  },
  {
    slug: 'kyoto-pour-over-coffee-set',
    name: 'Kyoto Pour-Over Carafe Set',
    category: 'Home',
    price: 9400,
    rating: 4.9,
    reviews_count: 93,
    stock: 24,
    image_url: '/images/coffee-set.jpg',
    short_description: 'Kiln-fired matte stoneware dripper paired with a hand-blown 600ml borosilicate carafe.',
    description: 'Crafted for unhurried morning rituals. Spiral interior ribs guide balanced extraction while the double-annealed borosilicate server pours cleanly without a single stray drop.',
    specs: ['600ml Hand-Blown Borosilicate', 'High-Fired Matte Kuro Stoneware', 'Precision Spiral Extraction Ribs', 'Compatible with Standard #02 Filters'],
    featured: 0
  },
  {
    slug: 'sage-insulated-vessel',
    name: 'Sage Vacuum Vessel',
    category: 'Carry',
    price: 4200,
    rating: 4.8,
    reviews_count: 218,
    stock: 40,
    image_url: '/images/tumbler.jpg',
    short_description: 'Copper-lined double-wall 600ml vacuum bottle in powder-coated matte sage stainless steel.',
    description: 'Precision-milled from medical-grade 18/8 stainless steel with an internal copper thermal barrier—maintaining ice-cold hydration for 24 hours or hot infusions for 12 hours without exterior condensation.',
    specs: ['600ml Copper-Lined Vacuum Core', 'Medical-Grade 18/8 Stainless Steel', '24h Cold / 12h Hot Thermal Lock', 'Leak-Proof Brushed Cap'],
    featured: 0
  }
];

async function initDatabase() {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = schemaSql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await run(stmt);
  }

  const row = await get('SELECT COUNT(*) AS count FROM products');
  if (!row || row.count === 0) {
    for (const p of SEED_PRODUCTS) {
      await run(
        `INSERT INTO products
          (slug, name, category, price, rating, reviews_count, stock, image_url, short_description, description, specs_json, featured)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.slug,
          p.name,
          p.category,
          p.price,
          p.rating,
          p.reviews_count,
          p.stock,
          p.image_url,
          p.short_description,
          p.description,
          JSON.stringify(p.specs),
          p.featured
        ]
      );
    }
    console.log(`Seeded ${SEED_PRODUCTS.length} luxury products (INR) into SQLite database.`);
  }
}

module.exports = { db, run, get, all, initDatabase };
