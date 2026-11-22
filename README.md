# Aether Goods — Simple E-Commerce Store

Full-stack e-commerce web application built with **HTML, CSS, JavaScript**, **Express.js (Node.js)**, and **SQLite**.

## Features
- **Product Listings**: Responsive catalog with live search, category filtering, and price/rating sorting.
- **Product Details Page**: Dedicated view with studio photography, full description, technical specs, live stock count, quantity selector, and related products.
- **Shopping Cart**: Slide-over cart drawer with add, remove, quantity adjustments, free-shipping threshold indicator, and automatic subtotal/tax/total calculations.
- **User Registration & Login**: Account creation and authentication backed by `bcryptjs` password hashing and JWT bearer tokens.
- **Order Processing**: Validated checkout flow with transactional stock updates in SQLite, instant order confirmation receipt, and a **My Orders** history view.

## Project Structure
```text
ecommerce-store/
├── server.js              # Express.js entry point
├── package.json           # Dependencies and start scripts
├── .env.example           # Environment configuration template
├── db/
│   ├── schema.sql         # SQLite tables: users, products, orders, order_items
│   └── database.js        # SQLite connection, schema init, and product seeding
├── middleware/
│   └── auth.js            # JWT authentication middleware
├── routes/
│   ├── auth.js            # POST /api/auth/register, /login, GET /me
│   ├── products.js        # GET /api/products, GET /api/products/:id
│   └── orders.js          # POST /api/orders, GET /api/orders
└── public/
    ├── index.html         # Storefront markup
    ├── css/styles.css     # Responsive styles
    ├── js/app.js          # Frontend state, routing, cart, auth & API client
    └── images/            # Product studio photography
```

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Copy `.env.example` to `.env` and set your own `JWT_SECRET`:
   ```bash
   cp .env.example .env
   ```
3. Start the server (SQLite database initializes and seeds automatically on first launch):
   ```bash
   npm start
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## REST API Endpoints
| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Public | List products (`?category=`, `?search=`, `?sort=`) |
| `GET` | `/api/products/:id` | Public | Get single product details by ID or slug |
| `POST` | `/api/auth/register` | Public | Create a new user account and receive a JWT |
| `POST` | `/api/auth/login` | Public | Authenticate user credentials and receive a JWT |
| `GET` | `/api/auth/me` | Bearer | Fetch current logged-in user profile |
| `POST` | `/api/orders` | Bearer | Process checkout order and decrement product stock |
| `GET` | `/api/orders` | Bearer | Retrieve authenticated user's order history |
