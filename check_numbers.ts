import Database from 'better-sqlite3';

const db = new Database('app.db');
const numbers = db.prepare('SELECT * FROM whatsapp_numbers').all();
console.log(JSON.stringify(numbers, null, 2));
