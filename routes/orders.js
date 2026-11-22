const express = require('express');
const { all, get, run } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const FREE_SHIPPING_THRESHOLD_INR = 15000;
const SHIPPING_FEE_INR = 499;
const GST_RATE = 0.18;
const PROMO_CODES = { PRIVILEGE10: 0.10 };

// POST /api/orders - Place a new order in INR
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { items, shipping, paymentMethod, promoCode } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Your shopping bag is empty.' });
    }

    if (
      !shipping ||
      !shipping.name ||
      !shipping.email ||
      !shipping.address ||
      !shipping.city ||
      !shipping.postal
    ) {
      return res.status(400).json({ error: 'Complete delivery information is required.' });
    }

    await run('BEGIN TRANSACTION');
    try {
      let subtotal = 0;
      const validatedItems = [];

      for (const item of items) {
        const qty = Number(item.quantity);
        if (!Number.isInteger(qty) || qty <= 0) {
          throw new Error('Invalid item quantity.');
        }

        const product = await get('SELECT * FROM products WHERE id = ?', [item.productId]);
        if (!product) {
          throw new Error(`Product #${item.productId} no longer exists.`);
        }
        if (product.stock < qty) {
          throw new Error(`Insufficient stock for ${product.name} (${product.stock} left).`);
        }

        const lineTotal = Math.round(product.price * qty);
        subtotal += lineTotal;
        validatedItems.push({
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: qty,
          lineTotal
        });
      }

      const normalizedCode = String(promoCode || '').trim().toUpperCase();
      const discountRate = PROMO_CODES[normalizedCode] || 0;
      const discount = Math.round(subtotal * discountRate);
      const netSubtotal = Math.max(0, subtotal - discount);
      const shippingCost = netSubtotal >= FREE_SHIPPING_THRESHOLD_INR ? 0 : SHIPPING_FEE_INR;
      const tax = Math.round(netSubtotal * GST_RATE);
      const total = netSubtotal + shippingCost + tax;
      const orderNumber = `MA-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

      const orderResult = await run(
        `INSERT INTO orders
          (order_number, user_id, shipping_name, shipping_email, shipping_address, shipping_city, shipping_postal, payment_method, subtotal, shipping_cost, tax, total, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')`,
        [
          orderNumber,
          req.user.id,
          shipping.name.trim(),
          shipping.email.trim(),
          shipping.address.trim(),
          shipping.city.trim(),
          shipping.postal.trim(),
          paymentMethod || 'UPI (GPay / PhonePe / Paytm)',
          netSubtotal,
          shippingCost,
          tax,
          total
        ]
      );

      for (const item of validatedItems) {
        await run(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderResult.id, item.productId, item.productName, item.unitPrice, item.quantity, item.lineTotal]
        );
        await run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.productId]);
      }

      await run('COMMIT');

      res.status(201).json({
        order: {
          id: orderResult.id,
          orderNumber,
          currency: 'INR',
          subtotal: netSubtotal,
          discount,
          shippingCost,
          tax,
          total,
          status: 'Confirmed',
          shipping,
          paymentMethod: paymentMethod || 'UPI (GPay / PhonePe / Paytm)',
          items: validatedItems,
          createdAt: new Date().toISOString()
        }
      });
    } catch (txErr) {
      await run('ROLLBACK');
      return res.status(400).json({ error: txErr.message || 'Could not process order.' });
    }
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ error: 'Server error while processing order.' });
  }
});

// GET /api/orders - List orders for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const orders = await all(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC',
      [req.user.id]
    );

    const enriched = [];
    for (const order of orders) {
      const items = await all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
      enriched.push({
        id: order.id,
        orderNumber: order.order_number,
        currency: 'INR',
        status: order.status,
        subtotal: order.subtotal,
        shippingCost: order.shipping_cost,
        tax: order.tax,
        total: order.total,
        paymentMethod: order.payment_method,
        shipping: {
          name: order.shipping_name,
          email: order.shipping_email,
          address: order.shipping_address,
          city: order.shipping_city,
          postal: order.shipping_postal
        },
        createdAt: order.created_at,
        items: items.map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          unitPrice: i.unit_price,
          quantity: i.quantity,
          lineTotal: i.line_total
        }))
      });
    }

    res.json({ orders: enriched });
  } catch (err) {
    console.error('Order list error:', err);
    res.status(500).json({ error: 'Failed to load order history.' });
  }
});

module.exports = router;
