import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

// Use environment variable for DB path (crucial for Render Persistent Disk)
const dbPath = process.env.DB_PATH || 'app.db';
console.log(`Using database at: ${dbPath}`);

const db = new Database(dbPath, { verbose: console.log });

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'CORE',
    plan_expires_at DATETIME,
    status TEXT NOT NULL DEFAULT 'ativa',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    consent BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year TEXT,
    plate TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    default_price REAL,
    recall_months INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT 1,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    sku TEXT,
    name TEXT NOT NULL,
    unit TEXT,
    cost REAL,
    price REAL,
    stock_qty INTEGER DEFAULT 0,
    min_qty INTEGER DEFAULT 0,
    is_stocked BOOLEAN DEFAULT 1,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'rascunho',
    valid_until DATETIME,
    total_amount REAL DEFAULT 0,
    current_version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    quote_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'service' or 'part'
    ref_id TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    discount REAL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (quote_id) REFERENCES quotes(id)
  );

  CREATE TABLE IF NOT EXISTS work_orders (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    total_amount REAL DEFAULT 0,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  );

  CREATE TABLE IF NOT EXISTS work_order_items (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    work_order_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'service' or 'part'
    ref_id TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    discount REAL DEFAULT 0,
    notes TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (work_order_id) REFERENCES work_orders(id)
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'novo',
    source TEXT,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_hint TEXT,
    intake_json TEXT,
    deadline_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS lead_messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    lead_id TEXT NOT NULL,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (lead_id) REFERENCES leads(id)
  );

  CREATE TABLE IF NOT EXISTS whatsapp_numbers (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    phone_number_id TEXT NOT NULL UNIQUE,
    phone_number TEXT NOT NULL,
    waba_id TEXT,
    access_token TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
  );

  CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    whatsapp_number_id TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    last_message_at DATETIME,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (whatsapp_number_id) REFERENCES whatsapp_numbers(id)
  );

  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    wa_message_id TEXT UNIQUE,
    direction TEXT NOT NULL, -- 'inbound' or 'outbound'
    type TEXT NOT NULL, -- 'text', 'image', etc.
    content TEXT NOT NULL,
    status TEXT, -- 'sent', 'delivered', 'read', 'failed'
    timestamp DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id)
  );
`);

// Add recall_months column if it doesn't exist
try {
  db.exec('ALTER TABLE services ADD COLUMN recall_months INTEGER DEFAULT 0');
} catch (e) {
  // Column already exists
}

// Add plan_expires_at column if it doesn't exist
try {
  db.exec('ALTER TABLE tenants ADD COLUMN plan_expires_at DATETIME');
} catch (e) {
  // Column already exists
}

// Add bot_active column if it doesn't exist
try {
  db.exec('ALTER TABLE whatsapp_conversations ADD COLUMN bot_active BOOLEAN DEFAULT 0');
} catch (e) {
  // Column already exists
}

// Seed initial data if empty
const tenantCount = db.prepare('SELECT COUNT(*) as count FROM tenants').get() as { count: number };
if (tenantCount.count === 0) {
  const tenantId = 't-1';
  db.prepare('INSERT INTO tenants (id, name, plan) VALUES (?, ?, ?)').run(tenantId, 'Oficina Modelo', 'CENTRAL');
  
  // Seed admin user
  // Password is 'admin123'
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (id, tenant_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)').run(
    'u-1', tenantId, 'admin@oficina.com', 'Admin Gestor', hash, 'Gestor'
  );

  // Seed some catalog items
  db.prepare('INSERT INTO services (id, tenant_id, name, category, default_price, recall_months) VALUES (?, ?, ?, ?, ?, ?)').run('s-1', tenantId, 'Troca de Óleo', 'Manutenção', 50.0, 6);
  db.prepare('INSERT INTO services (id, tenant_id, name, category, default_price, recall_months) VALUES (?, ?, ?, ?, ?, ?)').run('s-2', tenantId, 'Alinhamento e Balanceamento', 'Suspensão', 120.0, 12);
  
  db.prepare('INSERT INTO parts (id, tenant_id, sku, name, unit, cost, price, stock_qty, min_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('p-1', tenantId, 'OL-5W40', 'Óleo Sintético 5W40', 'Litro', 25.0, 45.0, 50, 10);
  db.prepare('INSERT INTO parts (id, tenant_id, sku, name, unit, cost, price, stock_qty, min_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('p-2', tenantId, 'FL-001', 'Filtro de Óleo', 'Unidade', 15.0, 30.0, 20, 5);

  // Seed a customer and vehicle
  db.prepare('INSERT INTO customers (id, tenant_id, name, phone) VALUES (?, ?, ?, ?)').run('c-1', tenantId, 'João Silva', '11999999999');
  db.prepare('INSERT INTO vehicles (id, tenant_id, customer_id, make, model, year, plate) VALUES (?, ?, ?, ?, ?, ?, ?)').run('v-1', tenantId, 'c-1', 'Volkswagen', 'Gol', '2018', 'ABC-1234');

  // Seed a lead
  db.prepare('INSERT INTO leads (id, tenant_id, status, source, contact_name, phone, vehicle_hint) VALUES (?, ?, ?, ?, ?, ?, ?)').run('l-1', tenantId, 'novo', 'WhatsApp', 'Maria Oliveira', '11988888888', 'Fiat Uno 2015 - Barulho no freio');
  
  // Seed a message for the lead
  db.prepare('INSERT INTO lead_messages (id, tenant_id, lead_id, sender, content) VALUES (?, ?, ?, ?, ?)').run('m-1', tenantId, 'l-1', 'customer', 'Olá, meu Fiat Uno 2015 está fazendo um barulho estranho no freio. Podem me ajudar?');
}

// Seed hardsolutions admin user
try {
  const adminHash = bcrypt.hashSync('hardignis18458416', 10);
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('hardsolutions');
  if (!existingAdmin) {
    const adminTenantId = 't-admin';
    const existingTenant = db.prepare('SELECT id FROM tenants WHERE id = ?').get(adminTenantId);
    if (!existingTenant) {
      db.prepare('INSERT INTO tenants (id, name, plan) VALUES (?, ?, ?)').run(adminTenantId, 'Hard Solutions', 'ADMIN');
    }
    db.prepare('INSERT INTO users (id, tenant_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)').run(
      'u-admin', adminTenantId, 'hardsolutions', 'Hard Solutions Admin', adminHash, 'SuperAdmin'
    );
  }
} catch (e) {
  console.error('Failed to seed admin user:', e);
}

export default db;
