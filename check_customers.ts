import Database from 'better-sqlite3';

const db = new Database('app.db');
const customers = db.prepare('SELECT * FROM customers').all();
console.log(JSON.stringify(customers, null, 2));
