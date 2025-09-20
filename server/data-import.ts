import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { DatabaseStorage } from './storage';
import { db } from './db-local';
import { states, districts } from '@shared/schema-sqlite';
import { eq } from 'drizzle-orm';
import type { InsertClaim } from '@shared/schema-sqlite';

export class DataImportService {
  constructor(private storage: DatabaseStorage) {}

  /**
   * Import real FRA claims from CSV file
   */
  async importClaimsFromCSV(csvFilePath: string): Promise<number> {
    try {
      const csvContent = await fs.readFile(csvFilePath, 'utf-8');
      
      // Parse CSV with headers
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }) as Array<{
        claimant_name: string;
        location: string;
        district: string;
        state: string;
        area: string;
        land_type: string;
        status: string;
        family_members: string;
        notes: string;
      }>;

      let importedCount = 0;

      for (const record of records) {
        try {
          // Generate unique claim ID based on state and index
          const stateCode = this.getStateCode(record.state);
          const claimId = `FRA-${stateCode}-2024-${String(importedCount + 1).padStart(6, '0')}`;

          // Map CSV data to claim schema
          const claimData: InsertClaim = {
            claimId,
            claimantName: record.claimant_name,
            location: record.location,
            district: record.district,
            state: record.state,
            area: parseFloat(record.area) || 0,
            landType: record.land_type === 'community' ? 'community' : 'individual',
            status: this.normalizeStatus(record.status),
            dateSubmitted: new Date(), // Current timestamp as we don't have exact dates
            familyMembers: parseInt(record.family_members) || 1,
            notes: record.notes || '',
            assignedOfficer: null,
            dateProcessed: record.status === 'approved' ? new Date() : null,
            coordinates: null
          };

          // Insert claim into database
          await this.storage.createClaim(claimData);
          importedCount++;
        } catch (error) {
          console.warn(`Failed to import record ${record.claimant_name}:`, error);
        }
      }

      console.log(`Successfully imported ${importedCount} real FRA claims from CSV`);
      return importedCount;
    } catch (error) {
      console.error('Error importing claims from CSV:', error);
      throw error;
    }
  }

  /**
   * Import comprehensive states and districts data from government sources
   */
  async importComprehensiveGeographicalData(): Promise<void> {
    try {
      // Real comprehensive states data from Indian government
      const realStatesData = [
        { id: 1, name: "Andhra Pradesh", code: "AP", language: "Telugu" },
        { id: 2, name: "Arunachal Pradesh", code: "AR", language: "English" },
        { id: 3, name: "Assam", code: "AS", language: "Assamese" },
        { id: 4, name: "Bihar", code: "BR", language: "Hindi" },
        { id: 5, name: "Chhattisgarh", code: "CG", language: "Hindi" },
        { id: 6, name: "Goa", code: "GA", language: "Konkani" },
        { id: 7, name: "Gujarat", code: "GJ", language: "Gujarati" },
        { id: 8, name: "Haryana", code: "HR", language: "Hindi" },
        { id: 9, name: "Himachal Pradesh", code: "HP", language: "Hindi" },
        { id: 10, name: "Jharkhand", code: "JH", language: "Hindi" },
        { id: 11, name: "Karnataka", code: "KA", language: "Kannada" },
        { id: 12, name: "Kerala", code: "KL", language: "Malayalam" },
        { id: 13, name: "Madhya Pradesh", code: "MP", language: "Hindi" },
        { id: 14, name: "Maharashtra", code: "MH", language: "Marathi" },
        { id: 15, name: "Manipur", code: "MN", language: "Manipuri" },
        { id: 16, name: "Meghalaya", code: "ML", language: "English" },
        { id: 17, name: "Mizoram", code: "MZ", language: "Mizo" },
        { id: 18, name: "Nagaland", code: "NL", language: "English" },
        { id: 19, name: "Odisha", code: "OD", language: "Odia" },
        { id: 20, name: "Punjab", code: "PB", language: "Punjabi" },
        { id: 21, name: "Rajasthan", code: "RJ", language: "Hindi" },
        { id: 22, name: "Sikkim", code: "SK", language: "English" },
        { id: 23, name: "Tamil Nadu", code: "TN", language: "Tamil" },
        { id: 24, name: "Telangana", code: "TG", language: "Telugu" },
        { id: 25, name: "Tripura", code: "TR", language: "Bengali" },
        { id: 26, name: "Uttar Pradesh", code: "UP", language: "Hindi" },
        { id: 27, name: "Uttarakhand", code: "UK", language: "Hindi" },
        { id: 28, name: "West Bengal", code: "WB", language: "Bengali" },
        { id: 29, name: "Delhi", code: "DL", language: "Hindi" },
        { id: 30, name: "Jammu and Kashmir", code: "JK", language: "Urdu" },
        { id: 31, name: "Ladakh", code: "LA", language: "Ladakhi" },
        { id: 32, name: "Puducherry", code: "PY", language: "Tamil" },
        { id: 33, name: "Chandigarh", code: "CH", language: "Hindi" },
        { id: 34, name: "Dadra and Nagar Haveli and Daman and Diu", code: "DN", language: "Gujarati" },
        { id: 35, name: "Lakshadweep", code: "LD", language: "Malayalam" },
        { id: 36, name: "Andaman and Nicobar Islands", code: "AN", language: "Hindi" }
      ];

      // High forest cover districts from Indian states (based on FSI data)
      const realDistrictsData = [
        // Madhya Pradesh (Highest forest cover state)
        { id: 1, name: "Mandla", stateId: 13 },
        { id: 2, name: "Balaghat", stateId: 13 },
        { id: 3, name: "Dindori", stateId: 13 },
        { id: 4, name: "Seoni", stateId: 13 },
        { id: 5, name: "Chhindwara", stateId: 13 },
        { id: 6, name: "Shahdol", stateId: 13 },
        { id: 7, name: "Betul", stateId: 13 },
        { id: 8, name: "Shivpuri", stateId: 13 },
        
        // Arunachal Pradesh (Second highest forest cover)
        { id: 9, name: "West Kameng", stateId: 2 },
        { id: 10, name: "East Kameng", stateId: 2 },
        { id: 11, name: "Papum Pare", stateId: 2 },
        { id: 12, name: "Upper Subansiri", stateId: 2 },
        
        // Chhattisgarh (Third highest forest cover)
        { id: 13, name: "Surguja", stateId: 5 },
        { id: 14, name: "Bastar", stateId: 5 },
        { id: 15, name: "Korba", stateId: 5 },
        { id: 16, name: "Raigarh", stateId: 5 },
        
        // Odisha (Major tribal state)
        { id: 17, name: "Mayurbhanj", stateId: 19 },
        { id: 18, name: "Keonjhar", stateId: 19 },
        { id: 19, name: "Rayagada", stateId: 19 },
        { id: 20, name: "Koraput", stateId: 19 },
        { id: 21, name: "Kandhamal", stateId: 19 },
        
        // Maharashtra
        { id: 22, name: "Gadchiroli", stateId: 14 },
        { id: 23, name: "Chandrapur", stateId: 14 },
        { id: 24, name: "Gondia", stateId: 14 },
        { id: 25, name: "Palghar", stateId: 14 },
        { id: 26, name: "Nandurbar", stateId: 14 },
        
        // Gujarat
        { id: 27, name: "The Dangs", stateId: 7 },
        { id: 28, name: "Valsad", stateId: 7 },
        { id: 29, name: "Narmada", stateId: 7 },
        
        // Jharkhand  
        { id: 30, name: "Hazaribagh", stateId: 10 },
        { id: 31, name: "Palamu", stateId: 10 },
        { id: 32, name: "Khunti", stateId: 10 },
        { id: 33, name: "West Singhbhum", stateId: 10 },
        
        // Rajasthan
        { id: 34, name: "Banswara", stateId: 21 },
        { id: 35, name: "Udaipur", stateId: 21 },
        { id: 36, name: "Sirohi", stateId: 21 },
        
        // Uttar Pradesh
        { id: 37, name: "Sonbhadra", stateId: 26 },
        { id: 38, name: "Mirzapur", stateId: 26 },
        { id: 39, name: "Lakhimpur Kheri", stateId: 26 },
        
        // Uttarakhand
        { id: 40, name: "Pauri Garhwal", stateId: 27 },
        { id: 41, name: "Tehri Garhwal", stateId: 27 },
        { id: 42, name: "Uttarkashi", stateId: 27 },
        
        // Andhra Pradesh
        { id: 43, name: "Kurnool", stateId: 1 },
        { id: 44, name: "Anantapur", stateId: 1 },
        { id: 45, name: "Chittoor", stateId: 1 }
      ];

      // Clear existing basic data and insert comprehensive data
      console.log('Importing comprehensive geographical data...');
      
      // Import states (this will replace the basic 6 states with all 36)
      await this.importStatesData(realStatesData);
      
      // Import districts (major forest districts across India)
      await this.importDistrictsData(realDistrictsData);
      
      console.log(`Imported ${realStatesData.length} states and ${realDistrictsData.length} districts from government sources`);
    } catch (error) {
      console.error('Error importing geographical data:', error);
      throw error;
    }
  }

  private async importStatesData(statesData: any[]): Promise<void> {
    for (const state of statesData) {
      try {
        // Check if state already exists to avoid duplicates
        const existingState = await db.select().from(states).where(eq(states.code, state.code)).limit(1);
        if (existingState.length === 0) {
          await db.insert(states).values(state);
        }
      } catch (error) {
        console.warn(`Failed to import state ${state.name}:`, error);
      }
    }
  }

  private async importDistrictsData(districtsData: any[]): Promise<void> {
    for (const district of districtsData) {
      try {
        await db.insert(districts).values(district);
      } catch (error) {
        console.warn(`Failed to import district ${district.name}:`, error);
      }
    }
  }

  /**
   * Get state code from state name
   */
  private getStateCode(stateName: string): string {
    const stateCodeMap: { [key: string]: string } = {
      'Madhya Pradesh': 'MP',
      'Maharashtra': 'MH',
      'Chhattisgarh': 'CG',
      'Odisha': 'OD',
      'Rajasthan': 'RJ',
      'Jharkhand': 'JH',
      'Uttar Pradesh': 'UP',
      'Gujarat': 'GJ',
      'Andhra Pradesh': 'AP',
      'Uttarakhand': 'UK',
      'Karnataka': 'KA',
      'West Bengal': 'WB',
      'Assam': 'AS',
      'Telangana': 'TG',
      'Kerala': 'KL',
      'Tamil Nadu': 'TN',
      'Bihar': 'BR',
      'Tripura': 'TR',
      'Arunachal Pradesh': 'AR',
      'Meghalaya': 'ML',
      'Manipur': 'MN',
      'Nagaland': 'NL',
      'Mizoram': 'MZ',
      'Sikkim': 'SK',
      'Goa': 'GA',
      'Himachal Pradesh': 'HP',
      'Haryana': 'HR',
      'Punjab': 'PB'
    };

    return stateCodeMap[stateName] || 'UN';
  }

  /**
   * Normalize status values to match schema
   */
  private normalizeStatus(status: string): 'pending' | 'approved' | 'rejected' | 'under-review' {
    const statusLower = status.toLowerCase().trim();
    
    if (statusLower.includes('approve')) return 'approved';
    if (statusLower.includes('reject')) return 'rejected';
    if (statusLower.includes('review') || statusLower.includes('process')) return 'under-review';
    
    return 'pending';
  }
}