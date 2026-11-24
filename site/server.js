// ============================================================
//  Noir&Blanc — сервер: Express + PostgreSQL (pg)
//  Сайт (папка public) -> REST API (/api) -> база noir_blanc
//  Запуск: npm start   (или node server.js)
// ============================================================
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const SESSION_DAYS = 7;

// ---------- Подключение к PostgreSQL ----------
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10
});

// ---------- Вспомогательные функции ----------
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

function parseCookies(req) {
    const header = req.headers.cookie;
    if (!header) return {};
    const result = {};
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) continue;
        const key = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        try { result[key] = decodeURIComponent(value); } catch { result[key] = value; }
    }
    return result;
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function publicUser(row) {
    return { id: row.userid, fullname: row.fullname, email: row.email, createdAt: row.createdat };
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function createSession(userid) {
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
        `INSERT INTO sessions (token, userid, expiresat)
         VALUES ($1, $2, now() + ($3 || ' days')::interval)`,
        [token, userid, String(SESSION_DAYS)]
    );
    return token;
}

function sessionCookie(token) {
    const parts = [
        `nb_session=${token}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`
    ];
    if (process.env.NODE_ENV === 'production') parts.push('Secure');
    return parts.join('; ');
}

function clearSessionCookie() {
    return 'nb_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

// На каждом запросе определяем пользователя по cookie сессии
app.use(async (req, res, next) => {
    try {
        const token = parseCookies(req).nb_session;
        if (token) {
            const { rows } = await pool.query(
                `SELECT u.userid, u.fullname, u.email, u.createdat
                   FROM sessions s
                   JOIN users u ON u.userid = s.userid
                  WHERE s.token = $1 AND s.expiresat > now()`,
                [token]
            );
            req.user = rows[0] || null;
            req.sessionToken = token;
        }
        next();
    } catch (err) {
        next(err);
    }
});

function requireAuth(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Нужно войти в аккаунт' });
    }
    next();
}

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// ============================================================
//  API: товары
// ============================================================
app.get('/api/health', wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT now() AS time');
    res.json({ ok: true, database: process.env.DB_NAME, time: rows[0].time });
}));

app.get('/api/products', wrap(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const brand = String(req.query.brand || '').trim();

    const { rows } = await pool.query(
        `SELECT p.perfumeid AS id,
                b.brandname  AS brand,
                p.name, p.type, p.gender, p.volume, p.price, p.description, p.image
           FROM perfumes p
           JOIN brands b ON b.brandid = p.brandid
          WHERE ($1 = '' OR p.name ILIKE '%' || $1 || '%' OR b.brandname ILIKE '%' || $1 || '%')
            AND ($2 = '' OR b.brandname = $2)
          ORDER BY b.brandname, p.name`,
        [search, brand]
    );
    res.json(rows);
}));

app.get('/api/brands', wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT brandid AS id, brandname AS name FROM brands ORDER BY brandname');
    res.json(rows);
}));

// ============================================================
//  API: регистрация и вход
// ============================================================
app.post('/api/auth/register', wrap(async (req, res) => {
    const fullname = String(req.body.fullname || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    if (fullname.length < 2) {
        return res.status(400).json({ error: 'Введите имя (минимум 2 символа)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Введите корректный email' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO users (fullname, email, passwordhash)
             VALUES ($1, $2, $3)
             RETURNING userid, fullname, email, createdat`,
            [fullname, email, hashPassword(password)]
        );
        const user = rows[0];
        const token = await createSession(user.userid);
        res.setHeader('Set-Cookie', sessionCookie(token));
        res.status(201).json({ user: publicUser(user) });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
        }
        throw err;
    }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');

    const { rows } = await pool.query(
        'SELECT userid, fullname, email, passwordhash, createdat FROM users WHERE email = $1',
        [email]
    );
    const user = rows[0];

    if (!user || !verifyPassword(password, user.passwordhash)) {
        return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    await pool.query('DELETE FROM sessions WHERE expiresat < now()');
    const token = await createSession(user.userid);
    res.setHeader('Set-Cookie', sessionCookie(token));
    res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', wrap(async (req, res) => {
    if (req.sessionToken) {
        await pool.query('DELETE FROM sessions WHERE token = $1', [req.sessionToken]);
    }
    res.setHeader('Set-Cookie', clearSessionCookie());
    res.json({ ok: true });
}));

app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
});

// ============================================================
//  API: личный кабинет
// ============================================================
app.patch('/api/account', requireAuth, wrap(async (req, res) => {
    const fullname = String(req.body.fullname || '').trim();

    if (fullname.length < 2) {
        return res.status(400).json({ error: 'Введите имя (минимум 2 символа)' });
    }
    if (fullname.length > 120) {
        return res.status(400).json({ error: 'Имя слишком длинное' });
    }

    const { rows } = await pool.query(
        `UPDATE users SET fullname = $1
          WHERE userid = $2
          RETURNING userid, fullname, email, createdat`,
        [fullname, req.user.userid]
    );
    res.json({ user: publicUser(rows[0]) });
}));

app.post('/api/account/password', requireAuth, wrap(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
    }

    const { rows } = await pool.query(
        'SELECT passwordhash FROM users WHERE userid = $1',
        [req.user.userid]
    );

    if (!rows.length || !verifyPassword(currentPassword, rows[0].passwordhash)) {
        return res.status(401).json({ error: 'Текущий пароль указан неверно' });
    }

    await pool.query(
        'UPDATE users SET passwordhash = $1 WHERE userid = $2',
        [hashPassword(newPassword), req.user.userid]
    );

    // Завершаем остальные сессии, текущую оставляем активной
    await pool.query(
        'DELETE FROM sessions WHERE userid = $1 AND token <> $2',
        [req.user.userid, req.sessionToken]
    );

    res.json({ ok: true });
}));

// ============================================================
//  API: обратная связь
// ============================================================
app.post('/api/contact', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const message = String(req.body.message || '').trim();

    if (name.length < 2) {
        return res.status(400).json({ error: 'Введите имя (минимум 2 символа)' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Введите корректный email' });
    }
    if (message.length < 5) {
        return res.status(400).json({ error: 'Сообщение слишком короткое' });
    }
    if (message.length > 5000) {
        return res.status(400).json({ error: 'Сообщение слишком длинное (максимум 5000 символов)' });
    }

    const { rows } = await pool.query(
        `INSERT INTO contact_messages (name, email, message)
         VALUES ($1, $2, $3)
         RETURNING messageid, createdat`,
        [name, email, message]
    );

    res.status(201).json({ ok: true, id: rows[0].messageid, createdAt: rows[0].createdat });
}));

// ============================================================
//  API: корзина (только для вошедших)
// ============================================================
const cartQuery = `
    SELECT c.perfumeid AS id, p.name, p.price, p.image, p.type, p.volume, p.gender, c.quantity
      FROM cart_items c
      JOIN perfumes p ON p.perfumeid = c.perfumeid
     WHERE c.userid = $1
     ORDER BY p.name`;

app.get('/api/cart', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query(cartQuery, [req.user.userid]);
    res.json(rows);
}));

app.post('/api/cart', requireAuth, wrap(async (req, res) => {
    const perfumeid = Number(req.body.perfumeid);
    const quantity = Math.max(1, Math.min(99, Number(req.body.quantity) || 1));

    if (!Number.isInteger(perfumeid)) {
        return res.status(400).json({ error: 'Некорректный товар' });
    }

    const exists = await pool.query('SELECT 1 FROM perfumes WHERE perfumeid = $1', [perfumeid]);
    if (!exists.rowCount) {
        return res.status(404).json({ error: 'Товар не найден' });
    }

    await pool.query(
        `INSERT INTO cart_items (userid, perfumeid, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (userid, perfumeid)
         DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, 99),
                       updatedat = now()`,
        [req.user.userid, perfumeid, quantity]
    );

    const { rows } = await pool.query(cartQuery, [req.user.userid]);
    res.status(201).json(rows);
}));

app.patch('/api/cart/:perfumeid', requireAuth, wrap(async (req, res) => {
    const perfumeid = Number(req.params.perfumeid);
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(perfumeid) || !Number.isInteger(quantity)) {
        return res.status(400).json({ error: 'Некорректные данные' });
    }

    if (quantity <= 0) {
        await pool.query(
            'DELETE FROM cart_items WHERE userid = $1 AND perfumeid = $2',
            [req.user.userid, perfumeid]
        );
    } else {
        await pool.query(
            'UPDATE cart_items SET quantity = $3, updatedat = now() WHERE userid = $1 AND perfumeid = $2',
            [req.user.userid, perfumeid, Math.min(quantity, 99)]
        );
    }

    const { rows } = await pool.query(cartQuery, [req.user.userid]);
    res.json(rows);
}));

app.delete('/api/cart/:perfumeid', requireAuth, wrap(async (req, res) => {
    await pool.query(
        'DELETE FROM cart_items WHERE userid = $1 AND perfumeid = $2',
        [req.user.userid, Number(req.params.perfumeid)]
    );
    const { rows } = await pool.query(cartQuery, [req.user.userid]);
    res.json(rows);
}));

// Объединение гостевой корзины (localStorage) с корзиной в БД после входа
app.post('/api/cart/merge', requireAuth, wrap(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const item of items.slice(0, 50)) {
            const perfumeid = Number(item.perfumeid);
            const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
            if (!Number.isInteger(perfumeid)) continue;
            await client.query(
                `INSERT INTO cart_items (userid, perfumeid, quantity)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (userid, perfumeid)
                 DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, 99),
                               updatedat = now()`,
                [req.user.userid, perfumeid, quantity]
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    const { rows } = await pool.query(cartQuery, [req.user.userid]);
    res.json(rows);
}));

// ============================================================
//  API: заказы
// ============================================================
app.post('/api/orders', requireAuth, wrap(async (req, res) => {
    const fullname = String(req.body.fullname || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = normalizeEmail(req.body.email);
    const delivery = String(req.body.delivery || '').trim();
    const address = String(req.body.address || '').trim();
    const payment = String(req.body.payment || '').trim();
    const comment = String(req.body.comment || '').trim() || null;

    if (fullname.length < 2 || phone.length < 5 || !address) {
        return res.status(400).json({ error: 'Заполните имя, телефон и адрес доставки' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Введите корректный email' });
    }
    if (!delivery || !payment) {
        return res.status(400).json({ error: 'Выберите доставку и способ оплаты' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const cart = await client.query(
            `SELECT c.perfumeid, c.quantity, p.price
               FROM cart_items c
               JOIN perfumes p ON p.perfumeid = c.perfumeid
              WHERE c.userid = $1
              FOR UPDATE OF c`,
            [req.user.userid]
        );

        if (!cart.rowCount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Корзина пуста' });
        }

        const total = cart.rows.reduce(
            (sum, row) => sum + Number(row.price) * row.quantity,
            0
        );
        const totalRounded = Math.round(total * 100) / 100;

        const order = await client.query(
            `INSERT INTO orders
                 (userid, status, totalamount, customername, phone, email, delivery, address, payment, comment)
             VALUES ($1, 'Новый', $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING orderid, orderdate, status, totalamount`,
            [req.user.userid, totalRounded, fullname, phone, email, delivery, address, payment, comment]
        );

        for (const row of cart.rows) {
            await client.query(
                `INSERT INTO order_items (orderid, perfumeid, quantity, unitprice)
                 VALUES ($1, $2, $3, $4)`,
                [order.rows[0].orderid, row.perfumeid, row.quantity, row.price]
            );
        }

        await client.query('DELETE FROM cart_items WHERE userid = $1', [req.user.userid]);
        await client.query('COMMIT');

        res.status(201).json({
            id: order.rows[0].orderid,
            number: 'NB-' + String(order.rows[0].orderid).padStart(6, '0'),
            date: order.rows[0].orderdate,
            status: order.rows[0].status,
            total: Number(order.rows[0].totalamount)
        });
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}));

app.get('/api/orders', requireAuth, wrap(async (req, res) => {
    const { rows } = await pool.query(
        `SELECT o.orderid AS id,
                o.orderdate AS date,
                o.status,
                o.totalamount AS total,
                o.customername, o.phone, o.email, o.delivery, o.address, o.payment, o.comment,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', oi.perfumeid,
                            'name', p.name,
                            'image', p.image,
                            'price', oi.unitprice,
                            'quantity', oi.quantity
                        ) ORDER BY oi.orderitemid
                    ) FILTER (WHERE oi.orderitemid IS NOT NULL),
                    '[]'::json
                ) AS items
           FROM orders o
           LEFT JOIN order_items oi ON oi.orderid = o.orderid
           LEFT JOIN perfumes p ON p.perfumeid = oi.perfumeid
          WHERE o.userid = $1
          GROUP BY o.orderid
          ORDER BY o.orderdate DESC`,
        [req.user.userid]
    );
    res.json(rows);
}));

// Неизвестный /api-маршрут
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API-метод не найден' });
});

// ============================================================
//  Раздача сайта из public/
// ============================================================
app.use(express.static(path.join(__dirname, 'public')));

// Ошибки
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ---------- Старт ----------
(async () => {
    try {
        const { rows } = await pool.query('SELECT current_database() AS db');
        console.log(`PostgreSQL подключена: база "${rows[0].db}"`);
        app.listen(PORT, () => {
            console.log(`Сайт:  http://localhost:${PORT}`);
            console.log(`API:   http://localhost:${PORT}/api/health`);
        });
    } catch (err) {
        console.error('Не удалось подключиться к PostgreSQL:', err.message);
        console.error('Проверьте параметры DB_* в файле .env и что служба PostgreSQL запущена.');
        process.exit(1);
    }
})();
