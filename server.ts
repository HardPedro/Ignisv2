import express from 'express';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from './server/db.js';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-mvp';

app.use(express.json());

// --- Authentication Middleware ---
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// --- API Routes ---

// Auth
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.role !== 'SuperAdmin') {
    const tenant = db.prepare('SELECT plan_expires_at FROM tenants WHERE id = ?').get(user.tenant_id) as any;
    if (tenant && tenant.plan_expires_at) {
      const expiresAt = new Date(tenant.plan_expires_at);
      if (expiresAt < new Date()) {
        return res.status(403).json({ error: 'Plano expirado. Entre em contato com o administrador.' });
      }
    }
  }

  const token = jwt.sign({ id: user.id, tenant_id: user.tenant_id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: user.tenant_id } });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, companyName } = req.body;
  
  if (!name || !email || !password || !companyName) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).json({ error: 'E-mail já cadastrado' });
  }

  const tenantId = 't-' + Date.now();
  const userId = 'u-' + Date.now();
  const hash = bcrypt.hashSync(password, 10);

  try {
    db.transaction(() => {
      db.prepare('INSERT INTO tenants (id, name, plan) VALUES (?, ?, ?)').run(tenantId, companyName, 'CORE');
      db.prepare('INSERT INTO users (id, tenant_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, tenantId, email, name, hash, 'Gestor'
      );
    })();

    const token = jwt.sign({ id: userId, tenant_id: tenantId, role: 'Gestor' }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: userId, name, email, role: 'Gestor', tenant_id: tenantId } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

app.get('/api/auth/me', authenticate, (req: any, res) => {
  const user = db.prepare('SELECT id, tenant_id, email, name, role FROM users WHERE id = ?').get(req.user.id) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role !== 'SuperAdmin') {
    const tenant = db.prepare('SELECT plan_expires_at FROM tenants WHERE id = ?').get(user.tenant_id) as any;
    if (tenant && tenant.plan_expires_at) {
      const expiresAt = new Date(tenant.plan_expires_at);
      if (expiresAt < new Date()) {
        return res.status(403).json({ error: 'Plano expirado. Entre em contato com o administrador.' });
      }
    }
  }

  res.json({ user });
});

// --- Admin Routes ---
app.get('/api/admin/accounts', authenticate, (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const accounts = db.prepare(`
    SELECT t.id as tenant_id, t.name as tenant_name, t.plan, t.plan_expires_at, u.id as user_id, u.name as user_name, u.email 
    FROM tenants t
    JOIN users u ON t.id = u.tenant_id
    WHERE u.role = 'Gestor' OR u.role = 'SuperAdmin'
  `).all();
  
  res.json(accounts);
});

app.post('/api/admin/accounts', authenticate, (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const { companyName, username, password, name, plan } = req.body;
  
  if (!companyName || !username || !password || !name) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(username);
  if (existingUser) {
    return res.status(400).json({ error: 'Usuário já cadastrado' });
  }

  const tenantId = 't-' + Date.now();
  const userId = 'u-' + Date.now();
  const hash = bcrypt.hashSync(password, 10);
  
  // Set expiration to 30 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const planValue = plan || 'Core Operacional';

  try {
    db.transaction(() => {
      db.prepare('INSERT INTO tenants (id, name, plan, plan_expires_at) VALUES (?, ?, ?, ?)').run(tenantId, companyName, planValue, expiresAt.toISOString());
      db.prepare('INSERT INTO users (id, tenant_id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, tenantId, username, name, hash, 'Gestor'
      );
    })();

    res.json({ success: true, tenantId, userId });
  } catch (err) {
    console.error('Create account error:', err);
    res.status(500).json({ error: 'Erro ao criar conta' });
  }
});

app.put('/api/admin/accounts/:tenantId/plan', authenticate, (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const { tenantId } = req.params;
  const { plan } = req.body;
  
  if (!plan) {
    return res.status(400).json({ error: 'O plano é obrigatório' });
  }
  
  // Set expiration to 30 days from now
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  
  try {
    db.prepare('UPDATE tenants SET plan = ?, plan_expires_at = ? WHERE id = ?').run(plan, expiresAt.toISOString(), tenantId);
    res.json({ success: true, plan, plan_expires_at: expiresAt.toISOString() });
  } catch (err) {
    console.error('Update plan error:', err);
    res.status(500).json({ error: 'Erro ao atualizar plano' });
  }
});

app.delete('/api/admin/accounts/:tenantId', authenticate, (req: any, res) => {
  if (req.user.role !== 'SuperAdmin') {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  
  const { tenantId } = req.params;
  
  // Prevent deleting the admin tenant
  if (tenantId === 't-admin') {
    return res.status(400).json({ error: 'Não é possível excluir a conta de administrador' });
  }
  
  try {
    // In a real app, you'd want to cascade delete or soft delete.
    // Here we'll just delete the users and the tenant for simplicity.
    db.transaction(() => {
      // Delete all data associated with the tenant
      db.prepare('DELETE FROM lead_messages WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM leads WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM work_order_items WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM work_orders WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM quote_items WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM quotes WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM parts WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM services WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM vehicles WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM customers WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM users WHERE tenant_id = ?').run(tenantId);
      db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
    })();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Erro ao excluir conta' });
  }
});

// Dashboard Stats
app.get('/api/dashboard', authenticate, (req: any, res) => {
  const tenant_id = req.user.tenant_id;
  
  const openOS = db.prepare("SELECT COUNT(*) as count FROM work_orders WHERE tenant_id = ? AND status NOT IN ('fechada', 'cancelada')").get(tenant_id) as any;
  const pendingQuotes = db.prepare("SELECT COUNT(*) as count FROM quotes WHERE tenant_id = ? AND status = 'enviado'").get(tenant_id) as any;
  const newLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE tenant_id = ? AND status = 'novo'").get(tenant_id) as any;
  const lowStock = db.prepare("SELECT COUNT(*) as count FROM parts WHERE tenant_id = ? AND is_stocked = 1 AND stock_qty <= min_qty").get(tenant_id) as any;

  // Revenue this month
  const revenueThisMonth = db.prepare(`
    SELECT SUM(total_amount) as total 
    FROM work_orders 
    WHERE tenant_id = ? AND status = 'fechada' AND strftime('%Y-%m', closed_at) = strftime('%Y-%m', 'now')
  `).get(tenant_id) as any;

  // Revenue last month
  const revenueLastMonth = db.prepare(`
    SELECT SUM(total_amount) as total 
    FROM work_orders 
    WHERE tenant_id = ? AND status = 'fechada' AND strftime('%Y-%m', closed_at) = strftime('%Y-%m', 'now', '-1 month')
  `).get(tenant_id) as any;

  // Closed OS this month
  const closedOSThisMonth = db.prepare(`
    SELECT COUNT(*) as count 
    FROM work_orders 
    WHERE tenant_id = ? AND status = 'fechada' AND strftime('%Y-%m', closed_at) = strftime('%Y-%m', 'now')
  `).get(tenant_id) as any;

  // Active Recalls (due in next 30 days or overdue)
  const activeRecalls = db.prepare(`
    SELECT COUNT(*) as count
    FROM work_orders w
    JOIN work_order_items wi ON w.id = wi.work_order_id
    JOIN services s ON wi.ref_id = s.id
    WHERE w.tenant_id = ? 
      AND w.status = 'fechada' 
      AND wi.type = 'service' 
      AND s.recall_months > 0
      AND date(w.closed_at, '+' || s.recall_months || ' months') <= date('now', '+30 days')
  `).get(tenant_id) as any;

  res.json({
    openOS: openOS.count,
    pendingQuotes: pendingQuotes.count,
    newLeads: newLeads.count,
    lowStock: lowStock.count,
    revenueThisMonth: revenueThisMonth.total || 0,
    revenueLastMonth: revenueLastMonth.total || 0,
    closedOSThisMonth: closedOSThisMonth.count,
    activeRecalls: activeRecalls.count
  });
});

// Recalls
app.get('/api/recalls', authenticate, (req: any, res) => {
  const recalls = db.prepare(`
    SELECT 
      c.name as customer_name,
      c.phone as customer_phone,
      v.plate as vehicle_plate,
      s.name as service_name,
      w.closed_at as last_service_date,
      date(w.closed_at, '+' || s.recall_months || ' months') as next_service_date
    FROM work_orders w
    JOIN work_order_items wi ON w.id = wi.work_order_id
    JOIN services s ON wi.ref_id = s.id
    JOIN customers c ON w.customer_id = c.id
    JOIN vehicles v ON w.vehicle_id = v.id
    WHERE w.tenant_id = ? 
      AND w.status = 'fechada' 
      AND wi.type = 'service' 
      AND s.recall_months > 0
      AND date(w.closed_at, '+' || s.recall_months || ' months') <= date('now', '+30 days')
    ORDER BY next_service_date ASC
  `).all(req.user.tenant_id);
  res.json(recalls);
});

// Customers
app.get('/api/customers', authenticate, (req: any, res) => {
  const customers = db.prepare('SELECT * FROM customers WHERE tenant_id = ? ORDER BY name').all(req.user.tenant_id);
  res.json(customers);
});

app.post('/api/customers', authenticate, (req: any, res) => {
  const { name, phone } = req.body;
  const id = 'c-' + Date.now();
  db.prepare('INSERT INTO customers (id, tenant_id, name, phone) VALUES (?, ?, ?, ?)').run(id, req.user.tenant_id, name, phone);
  res.json({ id, name, phone });
});

// Vehicles
app.get('/api/vehicles', authenticate, (req: any, res) => {
  const vehicles = db.prepare(`
    SELECT v.*, c.name as customer_name 
    FROM vehicles v 
    JOIN customers c ON v.customer_id = c.id 
    WHERE v.tenant_id = ?
  `).all(req.user.tenant_id);
  res.json(vehicles);
});

app.post('/api/vehicles', authenticate, (req: any, res) => {
  const { customer_id, make, model, year, plate } = req.body;
  const id = 'v-' + Date.now();
  db.prepare('INSERT INTO vehicles (id, tenant_id, customer_id, make, model, year, plate) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, req.user.tenant_id, customer_id, make, model, year, plate);
  res.json({ id, customer_id, make, model, year, plate });
});

// Catalog (Services & Parts)
app.get('/api/catalog', authenticate, (req: any, res) => {
  const services = db.prepare('SELECT * FROM services WHERE tenant_id = ?').all(req.user.tenant_id);
  const parts = db.prepare('SELECT * FROM parts WHERE tenant_id = ?').all(req.user.tenant_id);
  res.json({ services, parts });
});

app.post('/api/catalog/services', authenticate, (req: any, res) => {
  const { name, category, default_price, recall_months } = req.body;
  const id = 's-' + Date.now();
  db.prepare('INSERT INTO services (id, tenant_id, name, category, default_price, recall_months) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.user.tenant_id, name, category, default_price, recall_months || 0);
  res.json({ id, name, category, default_price, recall_months: recall_months || 0 });
});

app.post('/api/catalog/parts', authenticate, (req: any, res) => {
  const { sku, name, unit, cost, price, stock_qty, min_qty } = req.body;
  const id = 'p-' + Date.now();
  db.prepare('INSERT INTO parts (id, tenant_id, sku, name, unit, cost, price, stock_qty, min_qty) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.user.tenant_id, sku, name, unit, cost, price, stock_qty, min_qty);
  res.json({ id, sku, name, unit, cost, price, stock_qty, min_qty });
});

// Quotes
app.get('/api/quotes', authenticate, (req: any, res) => {
  const quotes = db.prepare(`
    SELECT q.*, c.name as customer_name, v.plate as vehicle_plate, v.make, v.model
    FROM quotes q
    JOIN customers c ON q.customer_id = c.id
    JOIN vehicles v ON q.vehicle_id = v.id
    WHERE q.tenant_id = ?
    ORDER BY q.created_at DESC
  `).all(req.user.tenant_id);
  res.json(quotes);
});

app.post('/api/quotes', authenticate, (req: any, res) => {
  const { customer_id, vehicle_id, items } = req.body;
  const id = 'q-' + Date.now();
  
  let total = 0;
  
  const insertQuote = db.prepare('INSERT INTO quotes (id, tenant_id, customer_id, vehicle_id, total_amount) VALUES (?, ?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO quote_items (id, tenant_id, quote_id, type, ref_id, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)');
  
  db.transaction(() => {
    insertQuote.run(id, req.user.tenant_id, customer_id, vehicle_id, 0); // Temporary total
    
    for (const item of items) {
      const itemId = 'qi-' + Date.now() + Math.random();
      insertItem.run(itemId, req.user.tenant_id, id, item.type, item.ref_id, item.qty, item.unit_price);
      total += item.qty * item.unit_price;
    }
    
    db.prepare('UPDATE quotes SET total_amount = ? WHERE id = ?').run(total, id);
  })();
  
  res.json({ id, total_amount: total });
});

app.put('/api/quotes/:id/status', authenticate, (req: any, res) => {
  const { status } = req.body;
  db.prepare('UPDATE quotes SET status = ? WHERE id = ? AND tenant_id = ?').run(status, req.params.id, req.user.tenant_id);
  
  // If accepted, create OS
  if (status === 'aceito') {
    const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id) as any;
    const osId = 'os-' + Date.now();
    db.prepare('INSERT INTO work_orders (id, tenant_id, customer_id, vehicle_id, total_amount) VALUES (?, ?, ?, ?, ?)').run(
      osId, quote.tenant_id, quote.customer_id, quote.vehicle_id, quote.total_amount
    );
    
    const items = db.prepare('SELECT * FROM quote_items WHERE quote_id = ?').all(req.params.id) as any[];
    const insertOsItem = db.prepare('INSERT INTO work_order_items (id, tenant_id, work_order_id, type, ref_id, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    db.transaction(() => {
      for (const item of items) {
        insertOsItem.run('osi-' + Date.now() + Math.random(), item.tenant_id, osId, item.type, item.ref_id, item.qty, item.unit_price);
      }
    })();
  }
  
  res.json({ success: true });
});

// Work Orders
app.get('/api/work-orders', authenticate, (req: any, res) => {
  const orders = db.prepare(`
    SELECT w.*, c.name as customer_name, v.plate as vehicle_plate, v.make, v.model
    FROM work_orders w
    JOIN customers c ON w.customer_id = c.id
    JOIN vehicles v ON w.vehicle_id = v.id
    WHERE w.tenant_id = ?
    ORDER BY w.opened_at DESC
  `).all(req.user.tenant_id);
  res.json(orders);
});

app.put('/api/work-orders/:id/status', authenticate, (req: any, res) => {
  const { status } = req.body;
  db.prepare('UPDATE work_orders SET status = ? WHERE id = ? AND tenant_id = ?').run(status, req.params.id, req.user.tenant_id);
  
  if (status === 'fechada') {
    db.prepare('UPDATE work_orders SET closed_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  }
  
  res.json({ success: true });
});

app.post('/api/work-orders', authenticate, (req: any, res) => {
  const { customer_id, vehicle_id, items } = req.body;
  const id = 'os-' + Date.now();
  
  db.transaction(() => {
    let total = 0;
    
    // Insert OS
    db.prepare('INSERT INTO work_orders (id, tenant_id, customer_id, vehicle_id, status) VALUES (?, ?, ?, ?, ?)').run(
      id, req.user.tenant_id, customer_id, vehicle_id, 'aberta'
    );
    
    // Insert items
    const insertItem = db.prepare('INSERT INTO work_order_items (id, tenant_id, work_order_id, type, ref_id, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)');
    
    for (const item of items) {
      insertItem.run('osi-' + Date.now() + Math.random(), req.user.tenant_id, id, item.type, item.ref_id, item.qty, item.unit_price);
      total += item.qty * item.unit_price;
    }
    
    // Update total
    db.prepare('UPDATE work_orders SET total_amount = ? WHERE id = ?').run(total, id);
  })();
  
  res.json({ id });
});

// Leads
app.get('/api/leads', authenticate, (req: any, res) => {
  const leads = db.prepare('SELECT * FROM leads WHERE tenant_id = ? ORDER BY created_at DESC').all(req.user.tenant_id);
  res.json(leads);
});

app.get('/api/leads/:id/messages', authenticate, (req: any, res) => {
  const messages = db.prepare('SELECT * FROM lead_messages WHERE lead_id = ? AND tenant_id = ? ORDER BY created_at ASC').all(req.params.id, req.user.tenant_id);
  res.json(messages);
});

app.post('/api/leads/:id/messages', authenticate, (req: any, res) => {
  const { content, sender } = req.body;
  const id = 'm-' + Date.now();
  db.prepare('INSERT INTO lead_messages (id, tenant_id, lead_id, sender, content) VALUES (?, ?, ?, ?, ?)').run(
    id, req.user.tenant_id, req.params.id, sender || 'user', content
  );
  res.json({ id, content, sender: sender || 'user', created_at: new Date().toISOString() });
});


// --- WhatsApp Integration ---

// Webhook Verification
app.get('/webhooks/whatsapp', (req, res) => {
  console.log('Received webhook verification request:', req.query);
  const verify_token = process.env.WHATSAPP_VERIFY_TOKEN || 'oficina_pro_webhook_token';
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verify_token) {
      console.log('WEBHOOK_VERIFIED with challenge:', challenge);
      res.status(200).send(String(challenge));
    } else {
      console.log('WEBHOOK_VERIFICATION_FAILED: Token mismatch', { expected: verify_token, received: token });
      res.sendStatus(403);
    }
  } else {
    console.log('WEBHOOK_VERIFICATION_FAILED: Missing mode or token');
    res.sendStatus(400);
  }
});

// Webhook Event Handler
app.post('/webhooks/whatsapp', (req, res) => {
  const body = req.body;

  if (body.object) {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      const message = body.entry[0].changes[0].value.messages[0];
      const contact = body.entry[0].changes[0].value.contacts[0];
      
      const wa_id = message.from;
      const msg_body = message.text ? message.text.body : '';
      const msg_id = message.id;
      const timestamp = new Date(message.timestamp * 1000).toISOString();
      const customer_name = contact ? contact.profile.name : 'Desconhecido';

      // Find the tenant associated with this phone number
      const waNumber = db.prepare('SELECT id, tenant_id FROM whatsapp_numbers WHERE phone_number_id = ?').get(phoneNumberId) as any;

      if (waNumber) {
        try {
          db.transaction(() => {
            // Find or create conversation
            let conversation = db.prepare('SELECT id FROM whatsapp_conversations WHERE whatsapp_number_id = ? AND customer_phone = ?').get(waNumber.id, wa_id) as any;
            
            if (!conversation) {
              const convId = 'wac-' + Date.now();
              db.prepare('INSERT INTO whatsapp_conversations (id, tenant_id, whatsapp_number_id, customer_phone, customer_name, last_message_at, bot_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                convId, waNumber.tenant_id, waNumber.id, wa_id, customer_name, timestamp, 1
              );
              conversation = { id: convId };
            } else {
              db.prepare('UPDATE whatsapp_conversations SET last_message_at = ?, customer_name = ? WHERE id = ?').run(timestamp, customer_name, conversation.id);
            }

            // Insert message
            db.prepare('INSERT OR IGNORE INTO whatsapp_messages (id, tenant_id, conversation_id, wa_message_id, direction, type, content, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
              'wam-' + Date.now() + Math.random(), waNumber.tenant_id, conversation.id, msg_id, 'inbound', message.type, msg_body, 'received', timestamp
            );
          })();
        } catch (err) {
          console.error('Error processing WhatsApp webhook:', err);
        }
      } else {
        console.warn(`Received message for unknown phone_number_id: ${phoneNumberId}`);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Internal APIs for WhatsApp

// Register a new WhatsApp number
app.post('/api/whatsapp/numbers', authenticate, (req: any, res) => {
  const { phone_number_id, phone_number, waba_id, access_token } = req.body;
  
  if (!phone_number_id || !phone_number) {
    return res.status(400).json({ error: 'phone_number_id and phone_number are required' });
  }

  const id = 'wan-' + Date.now();
  try {
    db.prepare(`
      INSERT INTO whatsapp_numbers (id, tenant_id, phone_number_id, phone_number, waba_id, access_token) 
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_number_id) DO UPDATE SET 
        access_token = excluded.access_token,
        phone_number = excluded.phone_number,
        waba_id = excluded.waba_id
    `).run(
      id, req.user.tenant_id, phone_number_id, phone_number, waba_id, access_token
    );
    res.json({ id, phone_number_id, phone_number });
  } catch (err: any) {
    console.error('Error registering WhatsApp number:', err);
    res.status(500).json({ error: 'Failed to register WhatsApp number' });
  }
});

// List registered numbers
app.get('/api/whatsapp/numbers', authenticate, (req: any, res) => {
  const numbers = db.prepare('SELECT id, phone_number_id, phone_number, waba_id, status, created_at FROM whatsapp_numbers WHERE tenant_id = ?').all(req.user.tenant_id);
  res.json(numbers);
});

// List conversations
app.get('/api/whatsapp/conversations', authenticate, (req: any, res) => {
  const conversations = db.prepare(`
    SELECT c.*, n.phone_number as business_number
    FROM whatsapp_conversations c
    JOIN whatsapp_numbers n ON c.whatsapp_number_id = n.id
    WHERE c.tenant_id = ?
    ORDER BY c.last_message_at DESC
  `).all(req.user.tenant_id);
  res.json(conversations);
});

// Start a new conversation
app.post('/api/whatsapp/conversations', authenticate, (req: any, res) => {
  const { customer_phone, customer_name, whatsapp_number_id } = req.body;
  
  if (!customer_phone || !whatsapp_number_id) {
    return res.status(400).json({ error: 'customer_phone and whatsapp_number_id are required' });
  }

  // Check if conversation already exists
  const existing = db.prepare('SELECT id FROM whatsapp_conversations WHERE whatsapp_number_id = ? AND customer_phone = ? AND tenant_id = ?').get(whatsapp_number_id, customer_phone, req.user.tenant_id) as any;
  
  if (existing) {
    return res.json({ id: existing.id, is_new: false });
  }

  const id = 'wac-' + Date.now();
  try {
    db.prepare('INSERT INTO whatsapp_conversations (id, tenant_id, whatsapp_number_id, customer_phone, customer_name, last_message_at, bot_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      id, req.user.tenant_id, whatsapp_number_id, customer_phone, customer_name || customer_phone, new Date().toISOString(), 1
    );
    res.json({ id, is_new: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// List messages for a conversation
app.get('/api/whatsapp/conversations/:id/messages', authenticate, (req: any, res) => {
  const messages = db.prepare('SELECT * FROM whatsapp_messages WHERE conversation_id = ? AND tenant_id = ? ORDER BY timestamp ASC').all(req.params.id, req.user.tenant_id);
  res.json(messages);
});

// Toggle bot for a conversation
app.put('/api/whatsapp/conversations/:id/bot', authenticate, (req: any, res) => {
  const { bot_active } = req.body;
  try {
    const result = db.prepare('UPDATE whatsapp_conversations SET bot_active = ? WHERE id = ? AND tenant_id = ?').run(bot_active ? 1 : 0, req.params.id, req.user.tenant_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json({ success: true, bot_active: !!bot_active });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update bot status' });
  }
});

// Auto-generate quote from bot
app.post('/api/whatsapp/conversations/:id/auto-quote', authenticate, (req: any, res) => {
  const { services = [], parts = [], vehicle_make = 'Desconhecido', vehicle_model = 'Desconhecido' } = req.body;
  const conversation_id = req.params.id;
  const tenant_id = req.user.tenant_id;

  try {
    // Get conversation details
    const conv = db.prepare('SELECT customer_phone, customer_name FROM whatsapp_conversations WHERE id = ? AND tenant_id = ?').get(conversation_id, tenant_id) as any;
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });

    // Find or create customer
    let customer = db.prepare('SELECT id FROM customers WHERE phone = ? AND tenant_id = ?').get(conv.customer_phone, tenant_id) as any;
    if (!customer) {
      const custId = 'c-' + Date.now();
      db.prepare('INSERT INTO customers (id, tenant_id, name, phone) VALUES (?, ?, ?, ?)').run(custId, tenant_id, conv.customer_name || 'Cliente WhatsApp', conv.customer_phone);
      customer = { id: custId };
    }

    // Find or create vehicle
    let vehicle = db.prepare('SELECT id FROM vehicles WHERE customer_id = ? AND tenant_id = ?').get(customer.id, tenant_id) as any;
    if (!vehicle) {
      const vehId = 'v-' + Date.now();
      db.prepare('INSERT INTO vehicles (id, tenant_id, customer_id, make, model) VALUES (?, ?, ?, ?, ?)').run(vehId, tenant_id, customer.id, vehicle_make, vehicle_model);
      vehicle = { id: vehId };
    }

    // Create quote
    const quoteId = 'q-' + Date.now();
    let totalAmount = 0;
    const itemsToInsert = [];

    // Process services
    for (const serviceName of services) {
      let srv = db.prepare('SELECT id, default_price FROM services WHERE name LIKE ? AND tenant_id = ?').get(`%${serviceName}%`, tenant_id) as any;
      if (!srv) {
        const srvId = 's-' + Date.now() + Math.random();
        const price = 100.0; // Default fallback price
        db.prepare('INSERT INTO services (id, tenant_id, name, category, default_price) VALUES (?, ?, ?, ?, ?)').run(srvId, tenant_id, serviceName, 'Geral', price);
        srv = { id: srvId, default_price: price };
      }
      itemsToInsert.push({ type: 'service', ref_id: srv.id, qty: 1, unit_price: srv.default_price });
      totalAmount += srv.default_price;
    }

    // Process parts
    for (const partName of parts) {
      let prt = db.prepare('SELECT id, price FROM parts WHERE name LIKE ? AND tenant_id = ?').get(`%${partName}%`, tenant_id) as any;
      if (!prt) {
        const prtId = 'p-' + Date.now() + Math.random();
        const price = 50.0; // Default fallback price
        db.prepare('INSERT INTO parts (id, tenant_id, name, unit, cost, price) VALUES (?, ?, ?, ?, ?, ?)').run(prtId, tenant_id, partName, 'Unidade', price * 0.5, price);
        prt = { id: prtId, price: price };
      }
      itemsToInsert.push({ type: 'part', ref_id: prt.id, qty: 1, unit_price: prt.price });
      totalAmount += prt.price;
    }

    db.transaction(() => {
      db.prepare('INSERT INTO quotes (id, tenant_id, customer_id, vehicle_id, total_amount) VALUES (?, ?, ?, ?, ?)').run(quoteId, tenant_id, customer.id, vehicle.id, totalAmount);
      
      const insertItem = db.prepare('INSERT INTO quote_items (id, tenant_id, quote_id, type, ref_id, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const item of itemsToInsert) {
        insertItem.run('qi-' + Date.now() + Math.random(), tenant_id, quoteId, item.type, item.ref_id, item.qty, item.unit_price);
      }
    })();

    res.json({ success: true, quote_id: quoteId, total_amount: totalAmount });
  } catch (err) {
    console.error('Auto-quote error:', err);
    res.status(500).json({ error: 'Failed to generate auto-quote' });
  }
});

// Send a message via API
app.post('/api/whatsapp/messages', authenticate, async (req: any, res) => {
  const { conversation_id, content } = req.body;

  if (!conversation_id || !content) {
    return res.status(400).json({ error: 'conversation_id and content are required' });
  }

  const conversation = db.prepare(`
    SELECT c.customer_phone, n.phone_number_id, n.access_token 
    FROM whatsapp_conversations c
    JOIN whatsapp_numbers n ON c.whatsapp_number_id = n.id
    WHERE c.id = ? AND c.tenant_id = ?
  `).get(conversation_id, req.user.tenant_id) as any;

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  if (!conversation.access_token) {
    return res.status(400).json({ error: 'WhatsApp access token not configured for this number' });
  }

  try {
    // Call WhatsApp API
    const response = await fetch(`https://graph.facebook.com/v17.0/${conversation.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${conversation.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: conversation.customer_phone,
        type: 'text',
        text: { body: content }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error:', data);
      return res.status(500).json({ error: 'Failed to send message via WhatsApp API', details: data });
    }

    const wa_message_id = data.messages?.[0]?.id;
    const timestamp = new Date().toISOString();

    // Save message to DB
    db.transaction(() => {
      db.prepare('INSERT INTO whatsapp_messages (id, tenant_id, conversation_id, wa_message_id, direction, type, content, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        'wam-' + Date.now() + Math.random(), req.user.tenant_id, conversation_id, wa_message_id, 'outbound', 'text', content, 'sent', timestamp
      );
      db.prepare('UPDATE whatsapp_conversations SET last_message_at = ? WHERE id = ?').run(timestamp, conversation_id);
    })();

    res.json({ success: true, message_id: wa_message_id });
  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    res.status(500).json({ error: 'Internal server error while sending message' });
  }
});

// --- 360dialog Integration (Test) ---

// Endpoint to register the webhook URL with 360dialog
app.post('/api/360dialog/set-webhook', authenticate, async (req: any, res) => {
  const { webhook_url } = req.body;

  if (!webhook_url) {
    return res.status(400).json({ error: 'webhook_url is required' });
  }

  // Pegar o primeiro número cadastrado (ou você pode passar o ID do número no body)
  const waNumber = db.prepare('SELECT access_token FROM whatsapp_numbers WHERE tenant_id = ? LIMIT 1').get(req.user.tenant_id) as any;

  if (!waNumber || !waNumber.access_token) {
    return res.status(400).json({ error: 'WhatsApp number with access token not found' });
  }

  try {
    const apiKey = waNumber.access_token.trim();
    let response = await fetch('https://waba.360dialog.io/v1/configs/webhook', {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: webhook_url })
    });

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      // Try waba-v2
      response = await fetch('https://waba-v2.360dialog.io/v1/configs/webhook', {
        method: 'POST',
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: webhook_url })
      });
    }

    if (response.status === 401 || response.status === 403 || response.status === 404) {
      // Try sandbox
      response = await fetch('https://waba-sandbox.360dialog.io/v1/configs/webhook', {
        method: 'POST',
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: webhook_url })
      });
    }

    let data;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error('360dialog Webhook Setup Error:', response.status, data);
      return res.status(500).json({ 
        error: 'Failed to set webhook via 360dialog API', 
        details: { status: response.status, ...data } 
      });
    }

    res.json({ success: true, message: 'Webhook configured successfully in 360dialog', data });
  } catch (err: any) {
    console.error('Error setting 360dialog webhook:', err);
    res.status(500).json({ error: 'Internal server error while setting webhook', details: err.message });
  }
});

const webhookLogs: any[] = [];
const apiLogs: any[] = [];

// Webhook Event Handler for 360dialog
app.post('/webhooks/360dialog', (req, res) => {
  const body = req.body;
  
  console.log('360dialog Webhook received:', JSON.stringify(body, null, 2));
  webhookLogs.unshift({ time: new Date().toISOString(), body });
  if (webhookLogs.length > 20) webhookLogs.pop();
  
  let messages = body.messages;
  let contacts = body.contacts;
  let statuses = body.statuses;

  // Check if it's Cloud API format (often used by 360dialog sandbox or newer setups)
  if (body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value) {
    const value = body.entry[0].changes[0].value;
    messages = value.messages;
    contacts = value.contacts;
    statuses = value.statuses;
  }
  
  if (contacts && messages && messages.length > 0) {
    // 360dialog /v1/ webhook format or Cloud API format
    const message = messages[0];
    const contact = contacts[0];
    
    const wa_id = message.from;
    const msg_body = message.text ? message.text.body : '';
    const msg_id = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000).toISOString();
    const customer_name = contact ? contact.profile.name : 'Desconhecido';
    
    // Para testes, vamos pegar o primeiro número cadastrado no banco
    const waNumber = db.prepare('SELECT id, tenant_id FROM whatsapp_numbers LIMIT 1').get() as any;

    if (waNumber) {
      try {
        db.transaction(() => {
          let conversation = db.prepare('SELECT id FROM whatsapp_conversations WHERE whatsapp_number_id = ? AND customer_phone = ?').get(waNumber.id, wa_id) as any;
          
          if (!conversation) {
            const convId = 'wac-' + Date.now();
            db.prepare('INSERT INTO whatsapp_conversations (id, tenant_id, whatsapp_number_id, customer_phone, customer_name, last_message_at, bot_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
              convId, waNumber.tenant_id, waNumber.id, wa_id, customer_name, timestamp, 1
            );
            conversation = { id: convId };
          } else {
            db.prepare('UPDATE whatsapp_conversations SET last_message_at = ?, customer_name = ? WHERE id = ?').run(timestamp, customer_name, conversation.id);
          }

          db.prepare('INSERT OR IGNORE INTO whatsapp_messages (id, tenant_id, conversation_id, wa_message_id, direction, type, content, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            'wam-' + Date.now() + Math.random(), waNumber.tenant_id, conversation.id, msg_id, 'inbound', message.type, msg_body, 'received', timestamp
          );
        })();
        console.log('360dialog message saved successfully');
      } catch (err) {
        console.error('Error processing 360dialog webhook:', err);
      }
    } else {
      console.warn('No WhatsApp number found in DB to associate with this message');
    }
  } else if (statuses && statuses.length > 0) {
    console.log('360dialog Webhook status update:', statuses);
    // Handle message status updates (sent, delivered, read, failed)
    const status = statuses[0];
    try {
      db.prepare('UPDATE whatsapp_messages SET status = ? WHERE wa_message_id = ?').run(
        status.status, status.id
      );
    } catch (err) {
      console.error('Error updating message status:', err);
    }
  }
  res.sendStatus(200);
});

app.get('/api/webhook-logs', (req, res) => {
  res.json(webhookLogs);
});

app.get('/api/api-logs', (req, res) => {
  res.json(apiLogs);
});

// Send a message via 360dialog API
app.post('/api/360dialog/messages', authenticate, async (req: any, res) => {
  const { conversation_id, content } = req.body;

  if (!conversation_id || !content) {
    return res.status(400).json({ error: 'conversation_id and content are required' });
  }

  const conversation = db.prepare(`
    SELECT c.customer_phone, n.phone_number_id, n.access_token 
    FROM whatsapp_conversations c
    JOIN whatsapp_numbers n ON c.whatsapp_number_id = n.id
    WHERE c.id = ? AND c.tenant_id = ?
  `).get(conversation_id, req.user.tenant_id) as any;

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  try {
    const apiKey = conversation.access_token.trim();
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: conversation.customer_phone,
      type: 'text',
      text: { body: content }
    };

    const logEntry: any = { time: new Date().toISOString(), payload, attempts: [] };
    apiLogs.unshift(logEntry);
    if (apiLogs.length > 20) apiLogs.pop();

    let url = `https://waba.360dialog.io/v1/messages`;
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    let text = await response.text();
    logEntry.attempts.push({ url, status: response.status, response: text });

    if (!response.ok) {
      url = `https://waba-v2.360dialog.io/v1/messages`;
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      text = await response.text();
      logEntry.attempts.push({ url, status: response.status, response: text });
    }

    if (!response.ok) {
      url = `https://waba-sandbox.360dialog.io/v1/messages`;
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'D360-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      text = await response.text();
      logEntry.attempts.push({ url, status: response.status, response: text });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    if (!response.ok) {
      console.error('360dialog API Error:', response.status, data);
      return res.status(500).json({ 
        error: 'Failed to send message via 360dialog API', 
        details: { status: response.status, ...data } 
      });
    }

    const wa_message_id = data.messages?.[0]?.id;
    const timestamp = new Date().toISOString();

    db.transaction(() => {
      db.prepare('INSERT INTO whatsapp_messages (id, tenant_id, conversation_id, wa_message_id, direction, type, content, status, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        'wam-' + Date.now() + Math.random(), req.user.tenant_id, conversation_id, wa_message_id, 'outbound', 'text', content, 'sent', timestamp
      );
      db.prepare('UPDATE whatsapp_conversations SET last_message_at = ? WHERE id = ?').run(timestamp, conversation_id);
    })();

    res.json({ success: true, message_id: wa_message_id });
  } catch (err) {
    console.error('Error sending 360dialog message:', err);
    res.status(500).json({ error: 'Internal server error while sending message' });
  }
});

// --- Vite Integration ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
