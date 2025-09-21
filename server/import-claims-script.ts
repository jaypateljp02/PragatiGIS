#!/usr/bin/env tsx

import { RealFRAImportService } from './real-fra-import';
import { DatabaseStorage } from './storage';

async function importClaims() {
  console.log('Starting authentic FRA claims import...');
  
  try {
    const storage = new DatabaseStorage();
    
    // Wait for database to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const importService = new RealFRAImportService(storage);
    
    // Import the authentic claims data
    const imported = await importService.importAuthenticClaimsData();
    
    console.log(`✅ Successfully imported ${imported} authentic FRA claims`);
    console.log('🎉 Real data integration complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importClaims();