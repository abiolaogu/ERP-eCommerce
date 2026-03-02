-- ERP-eCommerce Initial Schema
-- Generated: 2026-02-28
-- All tables use tenant isolation via tenant_id

-- ============================================================================
-- ecom_products - Product Catalog
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_products (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	name TEXT NOT NULL,
	sku TEXT NOT NULL,
	description TEXT,
	category TEXT,
	brand TEXT,
	price NUMERIC(18,2) NOT NULL,
	compare_at_price NUMERIC(18,2),
	cost NUMERIC(18,2),
	currency TEXT DEFAULT 'USD',
	weight NUMERIC(10,3),
	weight_unit TEXT CHECK (weight_unit IN ('kg','g','lb','oz')) DEFAULT 'kg',
	status TEXT CHECK (status IN ('active','draft','archived','out_of_stock','discontinued')) DEFAULT 'draft',
	tags JSONB DEFAULT '[]',
	images JSONB DEFAULT '[]',
	seo_title TEXT,
	seo_description TEXT,
	vendor TEXT,
	product_type TEXT,
	published_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_products_tenant_created ON ecom_products (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_products_tenant_category ON ecom_products (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_ecom_products_tenant_brand ON ecom_products (tenant_id, brand);
CREATE INDEX IF NOT EXISTS idx_ecom_products_tenant_status ON ecom_products (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecom_products_tenant_price ON ecom_products (tenant_id, price);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_products_tenant_sku ON ecom_products (tenant_id, sku);

-- ============================================================================
-- ecom_product_variants - Product Variants
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_product_variants (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	product_id TEXT NOT NULL,
	sku TEXT NOT NULL,
	name TEXT NOT NULL,
	price NUMERIC(18,2) NOT NULL,
	compare_at_price NUMERIC(18,2),
	cost NUMERIC(18,2),
	weight NUMERIC(10,3),
	inventory_quantity INT DEFAULT 0,
	options JSONB DEFAULT '{}',
	barcode TEXT,
	image_url TEXT,
	position INT DEFAULT 0,
	status TEXT CHECK (status IN ('active','inactive','out_of_stock','discontinued')) DEFAULT 'active',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_variants_tenant_created ON ecom_product_variants (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_variants_tenant_product ON ecom_product_variants (tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ecom_variants_tenant_status ON ecom_product_variants (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_variants_tenant_sku ON ecom_product_variants (tenant_id, sku);

-- ============================================================================
-- ecom_categories - Product Categories
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_categories (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	parent_id TEXT,
	description TEXT,
	image_url TEXT,
	sort_order INT DEFAULT 0,
	status TEXT CHECK (status IN ('active','inactive','hidden')) DEFAULT 'active',
	seo_title TEXT,
	seo_description TEXT,
	product_count INT DEFAULT 0,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_categories_tenant_created ON ecom_categories (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_categories_tenant_parent ON ecom_categories (tenant_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_ecom_categories_tenant_status ON ecom_categories (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecom_categories_tenant_sort ON ecom_categories (tenant_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_categories_tenant_slug ON ecom_categories (tenant_id, slug);

-- ============================================================================
-- ecom_orders - Orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_orders (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	customer_id TEXT NOT NULL,
	order_number TEXT NOT NULL,
	items JSONB DEFAULT '[]',
	subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
	shipping NUMERIC(18,2) DEFAULT 0,
	tax NUMERIC(18,2) DEFAULT 0,
	discount NUMERIC(18,2) DEFAULT 0,
	total NUMERIC(18,2) NOT NULL DEFAULT 0,
	currency TEXT DEFAULT 'USD',
	status TEXT CHECK (status IN ('pending','confirmed','processing','shipped','delivered','cancelled','refunded','returned','on_hold')) DEFAULT 'pending',
	payment_status TEXT CHECK (payment_status IN ('unpaid','authorized','paid','partially_refunded','refunded','voided')) DEFAULT 'unpaid',
	fulfillment_status TEXT CHECK (fulfillment_status IN ('unfulfilled','partial','fulfilled','returned')) DEFAULT 'unfulfilled',
	shipping_address JSONB DEFAULT '{}',
	billing_address JSONB DEFAULT '{}',
	shipping_method TEXT,
	tracking_number TEXT,
	notes TEXT,
	cancelled_at TIMESTAMPTZ,
	shipped_at TIMESTAMPTZ,
	delivered_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_orders_tenant_created ON ecom_orders (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_orders_tenant_customer ON ecom_orders (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_ecom_orders_tenant_status ON ecom_orders (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecom_orders_tenant_payment ON ecom_orders (tenant_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_ecom_orders_tenant_fulfillment ON ecom_orders (tenant_id, fulfillment_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_orders_tenant_order_number ON ecom_orders (tenant_id, order_number);

-- ============================================================================
-- ecom_customers - Customers
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_customers (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	email TEXT NOT NULL,
	first_name TEXT,
	last_name TEXT,
	phone TEXT,
	addresses JSONB DEFAULT '[]',
	tags JSONB DEFAULT '[]',
	total_orders INT DEFAULT 0,
	total_spent NUMERIC(18,2) DEFAULT 0,
	currency TEXT DEFAULT 'USD',
	status TEXT CHECK (status IN ('active','inactive','blocked','guest')) DEFAULT 'active',
	accepts_marketing BOOLEAN DEFAULT false,
	last_order_at TIMESTAMPTZ,
	notes TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_customers_tenant_created ON ecom_customers (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_customers_tenant_status ON ecom_customers (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecom_customers_tenant_name ON ecom_customers (tenant_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_ecom_customers_tenant_total_spent ON ecom_customers (tenant_id, total_spent DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_customers_tenant_email ON ecom_customers (tenant_id, email);

-- ============================================================================
-- ecom_inventory - Inventory Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_inventory (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	variant_id TEXT NOT NULL,
	warehouse_id TEXT,
	quantity INT NOT NULL DEFAULT 0,
	reserved INT DEFAULT 0,
	available INT DEFAULT 0,
	reorder_point INT DEFAULT 10,
	reorder_quantity INT DEFAULT 50,
	status TEXT CHECK (status IN ('in_stock','low_stock','out_of_stock','discontinued','backordered')) DEFAULT 'in_stock',
	last_counted_at TIMESTAMPTZ,
	last_restocked_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_inventory_tenant_created ON ecom_inventory (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_inventory_tenant_variant ON ecom_inventory (tenant_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_ecom_inventory_tenant_warehouse ON ecom_inventory (tenant_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_ecom_inventory_tenant_status ON ecom_inventory (tenant_id, status);

-- ============================================================================
-- ecom_promotions - Promotions / Coupons
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_promotions (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	name TEXT NOT NULL,
	code TEXT,
	type TEXT CHECK (type IN ('percentage','fixed_amount','free_shipping','buy_x_get_y','bundle','flash_sale')) NOT NULL DEFAULT 'percentage',
	value NUMERIC(18,2) NOT NULL DEFAULT 0,
	min_order NUMERIC(18,2) DEFAULT 0,
	max_discount NUMERIC(18,2),
	max_uses INT DEFAULT 0,
	used_count INT DEFAULT 0,
	per_customer_limit INT DEFAULT 1,
	start_date TIMESTAMPTZ NOT NULL,
	end_date TIMESTAMPTZ,
	applicable_products JSONB DEFAULT '[]',
	applicable_categories JSONB DEFAULT '[]',
	status TEXT CHECK (status IN ('active','inactive','expired','scheduled','exhausted')) DEFAULT 'scheduled',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_promotions_tenant_created ON ecom_promotions (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_promotions_tenant_type ON ecom_promotions (tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_ecom_promotions_tenant_status ON ecom_promotions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecom_promotions_tenant_dates ON ecom_promotions (tenant_id, start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ecom_promotions_tenant_code ON ecom_promotions (tenant_id, code) WHERE code IS NOT NULL;

-- ============================================================================
-- ecom_reviews - Product Reviews
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_reviews (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	product_id TEXT NOT NULL,
	customer_id TEXT,
	rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
	title TEXT,
	body TEXT,
	status TEXT CHECK (status IN ('pending','approved','rejected','flagged','spam')) DEFAULT 'pending',
	verified_purchase BOOLEAN DEFAULT false,
	helpful_count INT DEFAULT 0,
	reported_count INT DEFAULT 0,
	admin_reply TEXT,
	admin_replied_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_reviews_tenant_created ON ecom_reviews (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_reviews_tenant_product ON ecom_reviews (tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ecom_reviews_tenant_customer ON ecom_reviews (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_ecom_reviews_tenant_rating ON ecom_reviews (tenant_id, rating);
CREATE INDEX IF NOT EXISTS idx_ecom_reviews_tenant_status ON ecom_reviews (tenant_id, status);

-- ============================================================================
-- ecom_shipping_zones - Shipping Zones
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_shipping_zones (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	name TEXT NOT NULL,
	countries JSONB DEFAULT '[]',
	regions JSONB DEFAULT '[]',
	rates JSONB DEFAULT '[]',
	free_shipping_threshold NUMERIC(18,2),
	currency TEXT DEFAULT 'USD',
	handling_fee NUMERIC(18,2) DEFAULT 0,
	estimated_days_min INT,
	estimated_days_max INT,
	status TEXT CHECK (status IN ('active','inactive','draft')) DEFAULT 'draft',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_shipping_tenant_created ON ecom_shipping_zones (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_shipping_tenant_status ON ecom_shipping_zones (tenant_id, status);

-- ============================================================================
-- ecom_subscriptions - Subscription Orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecom_subscriptions (
	id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
	tenant_id TEXT NOT NULL,
	customer_id TEXT NOT NULL,
	product_id TEXT NOT NULL,
	variant_id TEXT,
	interval TEXT CHECK (interval IN ('daily','weekly','biweekly','monthly','quarterly','semi_annual','annual')) NOT NULL DEFAULT 'monthly',
	interval_count INT DEFAULT 1,
	price NUMERIC(18,2) NOT NULL,
	currency TEXT DEFAULT 'USD',
	status TEXT CHECK (status IN ('active','paused','cancelled','expired','past_due','trialing','pending')) DEFAULT 'pending',
	trial_ends_at TIMESTAMPTZ,
	current_period_start TIMESTAMPTZ,
	current_period_end TIMESTAMPTZ,
	next_billing_at TIMESTAMPTZ,
	cancelled_at TIMESTAMPTZ,
	cancel_reason TEXT,
	billing_cycles_completed INT DEFAULT 0,
	shipping_address JSONB DEFAULT '{}',
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecom_subscriptions_tenant_created ON ecom_subscriptions (tenant_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecom_subscriptions_tenant_customer ON ecom_subscriptions (tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_ecom_subscriptions_tenant_product ON ecom_subscriptions (tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_ecom_subscriptions_tenant_status ON ecom_subscriptions (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ecom_subscriptions_tenant_billing ON ecom_subscriptions (tenant_id, next_billing_at);

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

ALTER TABLE ecom_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_shipping_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecom_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ecom_products_tenant_isolation ON ecom_products
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_product_variants_tenant_isolation ON ecom_product_variants
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_categories_tenant_isolation ON ecom_categories
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_orders_tenant_isolation ON ecom_orders
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_customers_tenant_isolation ON ecom_customers
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_inventory_tenant_isolation ON ecom_inventory
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_promotions_tenant_isolation ON ecom_promotions
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_reviews_tenant_isolation ON ecom_reviews
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_shipping_zones_tenant_isolation ON ecom_shipping_zones
	USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY ecom_subscriptions_tenant_isolation ON ecom_subscriptions
	USING (tenant_id = current_setting('app.tenant_id', true));
