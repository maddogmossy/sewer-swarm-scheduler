#!/usr/bin/env node

/**
 * Neon Database Setup Helper
 * 
 * This script helps you set up your Neon database connection.
 * Run: node scripts/setup-neon.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('\n🚀 Neon Database Setup Helper\n');
  console.log('This script will help you configure your Neon database connection.\n');
  
  console.log('📋 Prerequisites:');
  console.log('   1. Sign up at https://neon.tech (free tier available)');
  console.log('   2. Create a new project');
  console.log('   3. Copy your connection string from the Neon dashboard\n');
  
  const hasAccount = await question('Have you already created a Neon account and project? (y/n): ');
  
  if (hasAccount.toLowerCase() !== 'y') {
    console.log('\n📝 Please complete these steps first:');
    console.log('   1. Go to https://neon.tech and sign up');
    console.log('   2. Create a new project');
    console.log('   3. Copy your connection string');
    console.log('\nThen run this script again.\n');
    rl.close();
    return;
  }
  
  console.log('\n📋 Next, you need your connection string from Neon.');
  console.log('   It should look like:');
  console.log('   postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/neondb?sslmode=require\n');
  
  const connectionString = await question('Paste your Neon connection string here: ');
  
  if (!connectionString || !connectionString.includes('neon.tech')) {
    console.log('\n❌ Invalid connection string. It should contain "neon.tech"');
    rl.close();
    return;
  }
  
  // Ensure connection string has sslmode if not present
  let finalConnectionString = connectionString.trim();
  if (!finalConnectionString.includes('sslmode=')) {
    finalConnectionString += (finalConnectionString.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = `# Development Database (Neon)
DATABASE_URL=${finalConnectionString}

# Production Database (set this in your production environment, not here)
# PRODUCTION_DATABASE_URL=postgresql://user:password@your-rds-instance.rds.amazonaws.com:5432/postgres
`;
  
  // Check if .env.local already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question('\n⚠️  .env.local already exists. Overwrite? (y/n): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('\n❌ Setup cancelled. Your existing .env.local was not modified.');
      rl.close();
      return;
    }
  }
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Successfully created .env.local with your Neon connection string!');
    console.log(`   File location: ${envPath}\n`);
    console.log('📋 Next steps:');
    console.log('   1. Restart your dev server (if running): npm run dev');
    console.log('   2. Test connection: http://localhost:3000/api/check-db');
    console.log('   3. Run migrations: http://localhost:3000/api/migrate (POST request)');
    console.log('   4. Verify setup: http://localhost:3000/api/check-db\n');
  } catch (error) {
    console.error('\n❌ Error writing .env.local:', error.message);
  }
  
  rl.close();
}

main().catch(console.error);



