
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
} from 'typeorm';

@Entity({ name: 'customers' })
export class Customer {
    @PrimaryGeneratedColumn({ name: 'customer_id', type: 'int' })
    customer_id!: number;

    @Column({ name: 'full_name', type: 'varchar', length: 100 })
    full_name!: string;

    @Column({ type: 'varchar', length: 150 })
    email!: string;

    @Column({ type: 'varchar', length: 20, nullable: true })
    phone!: string | null;

    @Column({ type: 'varchar', length: 100, nullable: true })
    city!: string | null;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'datetime', nullable: true })
    updated_at!: Date | null;
}

@Entity({ name: 'categories' })
export class Category {
    @PrimaryGeneratedColumn({ name: 'category_id', type: 'int' })
    category_id!: number;

    @Column({ type: 'varchar', length: 100 })
    category_name!: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'datetime', nullable: true })
    updated_at!: Date | null;
}

@Entity({ name: 'products' })
export class Product {
    @PrimaryGeneratedColumn({ name: 'product_id', type: 'int' })
    product_id!: number;

    @Column({ type: 'int' })
    category_id!: number;

    @Column({ type: 'varchar', length: 150 })
    product_name!: string;

    @Column({ type: 'varchar', length: 50 })
    sku!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price!: string;

    @Column({ type: 'int', default: 0 })
    stock!: number;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'datetime', nullable: true })
    updated_at!: Date | null;
}

@Entity({ name: 'orders' })
export class Order {
    @PrimaryGeneratedColumn({ name: 'order_id', type: 'int' })
    order_id!: number;

    @Column({ type: 'int' })
    customer_id!: number;

    @Column({ type: 'varchar', length: 20 })
    order_status!: string;

    @Column({ type: 'datetime' })
    order_date!: Date;

    @Column({ type: 'datetime', nullable: true })
    shipped_at!: Date | null;

    @Column({ type: 'datetime', nullable: true })
    delivered_at!: Date | null;

    @Column({ type: 'datetime', nullable: true })
    cancelled_at!: Date | null;

    @Column({ type: 'datetime', nullable: true })
    returned_at!: Date | null;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'datetime', nullable: true })
    updated_at!: Date | null;
}

@Entity({ name: 'order_items' })
export class OrderItem {
    @PrimaryGeneratedColumn({ name: 'order_item_id', type: 'int' })
    order_item_id!: number;

    @Column({ type: 'int' })
    order_id!: number;

    @Column({ type: 'int' })
    product_id!: number;

    @Column({ type: 'int' })
    quantity!: number;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    unit_price!: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'datetime', nullable: true })
    updated_at!: Date | null;
}
