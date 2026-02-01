#!/usr/bin/env node

/**
 * Update User Role Script
 * 
 * This script allows you to update a user's role in the database.
 * Usage: node scripts/update-user-role.js <username> <role>
 * 
 * Roles: admin, operations, user
 * 
 * Example:
 *   node scripts/update-user-role.js mike.moss admin
 */

const { Pool } = require('pg');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load .env.local file
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        // Remove quotes if present
        const cleanValue = value.replace(/^["']|["']$/g, '');
        if (key && cleanValue) {
          process.env[key.trim()] = cleanValue;
        }
      }
    });
  }
}

// Load environment variables
loadEnvFile();

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
  const args = process.argv.slice(2);
  let username = args[0];
  let role = args[1];

  console.log('\n🔐 Update User Role Script\n');

  // Get database URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.error('   Please set it in your .env.local file or export it');
    process.exit(1);
  }

  // Create pool
  const poolConfig = {
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('.rds.amazonaws.com') 
      ? { rejectUnauthorized: false }
      : false,
  };

  const pool = new Pool(poolConfig);

  try {
    // Get username if not provided
    if (!username) {
      username = await question('Enter username to update: ');
    }

    // Validate username
    if (!username.trim()) {
      console.error('❌ Username cannot be empty');
      process.exit(1);
    }

    // Get role if not provided
    if (!role) {
      console.log('\nAvailable roles:');
      console.log('  1. admin - Full access to all features');
      console.log('  2. operations - Manage schedules and approve bookings');
      console.log('  3. user - Create booking requests (view only)');
      role = await question('\nEnter role (admin/operations/user): ');
    }

    // Validate role
    const validRoles = ['admin', 'operations', 'user'];
    if (!validRoles.includes(role.toLowerCase())) {
      console.error(`❌ Invalid role. Must be one of: ${validRoles.join(', ')}`);
      process.exit(1);
    }

    role = role.toLowerCase();

    // Find user
    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE username = $1',
      [username]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User "${username}" not found`);
      process.exit(1);
    }

    const user = userResult.rows[0];
    console.log(`\n✓ Found user: ${user.username} (${user.email || 'no email'})`);

    // Find membership
    const membershipResult = await pool.query(
      `SELECT 
        om.id as membership_id,
        om.role as current_role,
        o.name as organization_name
      FROM organization_memberships om
      JOIN organizations o ON om.organization_id = o.id
      WHERE om.user_id = $1`,
      [user.id]
    );

    if (membershipResult.rows.length === 0) {
      console.error(`❌ No organization membership found for user "${username}"`);
      process.exit(1);
    }

    const membership = membershipResult.rows[0];
    console.log(`✓ Current role: ${membership.current_role}`);
    console.log(`✓ Organization: ${membership.organization_name}`);

    if (membership.current_role === role) {
      console.log(`\n⚠️  User already has role "${role}". No changes needed.`);
      process.exit(0);
    }

    // Confirm update
    const confirm = await question(
      `\n⚠️  Change role from "${membership.current_role}" to "${role}"? (yes/no): `
    );

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Update cancelled');
      process.exit(0);
    }

    // Update role
    await pool.query(
      'UPDATE organization_memberships SET role = $1 WHERE id = $2',
      [role, membership.membership_id]
    );

    console.log(`\n✅ Successfully updated "${username}" role to "${role}"`);
    console.log('\n📋 Next steps:');
    console.log('   1. The user may need to log out and log back in');
    console.log('   2. Their permissions will be updated immediately');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    rl.close();
  }
}

main().catch(console.error);

