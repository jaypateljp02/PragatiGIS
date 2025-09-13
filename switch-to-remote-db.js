#!/usr/bin/env node

// Simple script to switch back to remote Neon database
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔄 Switching to remote Neon PostgreSQL database...');

// Create/update .env file with USE_LOCAL_DB=false
const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Remove any existing USE_LOCAL_DB setting
envContent = envContent
  .split('\n')
  .filter(line => !line.startsWith('USE_LOCAL_DB='))
  .join('\n');

// Add USE_LOCAL_DB=false (or just remove it since false is default)
envContent += '\nUSE_LOCAL_DB=false\n';

fs.writeFileSync(envPath, envContent);

console.log('✅ Environment configured for remote database');
console.log('☁️ Using Neon PostgreSQL database');
console.log('🚀 Restart the server to use remote database');
console.log('');
console.log('To switch back to local database, run: node switch-to-local-db.js');