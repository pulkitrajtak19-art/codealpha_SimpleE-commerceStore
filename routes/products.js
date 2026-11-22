const express = require('express');
const { all, get } = require('../db/database');

const router = express.Router();

function formatProduct(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    price: row.price,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    stock: row.stock,
    imageUrl: row.image_url,
    shortDescription: row.short_description,
    description: row.description,
    specs: JSON.parse(row.specs_json || '[]'),
    featured: Boolean(row.featured)
  };
}

// GET /api/products?category=Workspace&search=lamp&sort=price_asc
router.get('/', async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    const clauses = [];
    const params = [];

    if (category && category !== 'All') {
      clauses.push('category = ?');
      params.push(category);
    }

    if (search && search.trim()) {
      clauses.push('(name LIKE ? OR short_description LIKE ? OR category LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    let orderBy = 'ORDER BY featured DESC, id ASC';
    if (sort === 'price_asc') orderBy = 'ORDER BY price ASC';
    else if (sort === 'price_desc') orderBy = 'ORDER BY price DESC';
    else if (sort === 'rating') orderBy = 'ORDER BY rating DESC';

    const rows = await all(`SELECT * FROM products ${where} ${orderBy}`, params);
    res.json({ products: rows.map(formatProduct) });
  } catch (err) {
    console.error('Products list error:', err);
    res.status(500).json({ error: 'Failed to load products.' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const param = req.params.id;
    const row = /^\d+$/.test(param)
      ? await get('SELECT * FROM products WHERE id = ?', [Number(param)])
      : await get('SELECT * FROM products WHERE slug = ?', [param]);

    if (!row) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    res.json({ product: formatProduct(row) });
  } catch (err) {
    console.error('Product detail error:', err);
    res.status(500).json({ error: 'Failed to load product details.' });
  }
});

module.exports = router;
