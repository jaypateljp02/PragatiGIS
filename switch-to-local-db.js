#!/usr/bin/env node

// Simple script to switch to local SQLite database
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔄 Switching to local SQLite database...');

// Create/update .env file with USE_LOCAL_DB=true
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

// Add USE_LOCAL_DB=true
envContent += '\nUSE_LOCAL_DB=true\n';

fs.writeFileSync(envPath, envContent);

console.log('✅ Environment configured for local database');
console.log('📁 Local database will be created at: ./local-database.db');
console.log('🚀 Restart the server to use local SQLite database');
console.log('');
console.log('Demo users available:');
console.log('- Username: ministry.admin | Password: admin123 (Ministry Administrator)');
console.log('- Username: mp.admin | Password: state123 (MP State Administrator)');
console.log('- Username: district.officer | Password: district123 (District Officer)');  
console.log('- Username: village.officer | Password: village123 (Village Officer)');
console.log('');
console.log('To switch back to remote database, run: node switch-to-remote-db.js');