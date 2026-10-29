
import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

import { AppDataSource } from './config/database';
import {
    Customer,
    Category,
    Product,
    Order,
    OrderItem,
} from './models/entities';
import { createCrudRouter } from './routes/crudRoutes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
    res.json({
        message: 'E-commerce Order Analytics API is running',
        database: 'MySQL',
        endpoints: [
            '/api/customers',
            '/api/categories',
            '/api/products',
            '/api/orders',
            '/api/order-items',
        ],
    });
});

app.use('/api/customers', createCrudRouter(
    Customer,
    'customer_id',
    ['full_name', 'email'],
    ['full_name', 'email', 'phone', 'city'],
));

app.use('/api/categories', createCrudRouter(
    Category,
    'category_id',
    ['category_name'],
    ['category_name'],
));

app.use('/api/products', createCrudRouter(
    Product,
    'product_id',
    ['category_id', 'product_name', 'sku', 'price', 'stock'],
    ['category_id', 'product_name', 'sku', 'price', 'stock'],
));

app.use('/api/orders', createCrudRouter(
    Order,
    'order_id',
    ['customer_id', 'order_status', 'order_date'],
    [
        'customer_id',
        'order_status',
        'order_date',
        'shipped_at',
        'delivered_at',
        'cancelled_at',
        'returned_at',
    ],
));

app.use('/api/order-items', createCrudRouter(
    OrderItem,
    'order_item_id',
    ['order_id', 'product_id', 'quantity', 'unit_price'],
    ['order_id', 'product_id', 'quantity', 'unit_price'],
));

app.use((_req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});

app.use((
    error: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
) => {
    console.error('API error:', error.message);

    if (error.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ message: 'Duplicate value already exists' });
        return;
    }

    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        res.status(400).json({
            message: 'Referenced customer, category, product or order does not exist',
        });
        return;
    }

    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        res.status(409).json({
            message: 'Cannot delete this record because another record references it',
        });
        return;
    }

    if (
        error.code === 'ER_BAD_NULL_ERROR' ||
        error.code === 'ER_TRUNCATED_WRONG_VALUE' ||
        error.code === 'ER_WARN_DATA_OUT_OF_RANGE' ||
        error.code === 'ER_CHECK_CONSTRAINT_VIOLATED'
    ) {
        res.status(400).json({ message: 'Invalid data supplied' });
        return;
    }

    res.status(500).json({ message: 'Internal server error' });
});

async function startServer() {
    try {
        await AppDataSource.initialize();
        console.log('MySQL database connected successfully');

        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start application:', error);
        process.exit(1);
    }
}

startServer();
