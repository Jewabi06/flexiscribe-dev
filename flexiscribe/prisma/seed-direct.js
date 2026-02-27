require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  console.log("Starting database seed...");
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Hash the admin password
    const hashedPassword = await bcrypt.hash("skyadminacc0123", 10);

    // Check if admin exists
    const existingAdmin = await pool.query(
      'SELECT * FROM "User" WHERE email = $1',
      ['skyadmin@example.com']
    );

    let admin;
    if (existingAdmin.rows.length > 0) {
      console.log("Admin user already exists, skipping creation...");
      admin = existingAdmin.rows[0];
    } else {
      // Create admin user
      const result = await pool.query(
        'INSERT INTO "User" (id, email, password, role, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING *',
        ['skyadmin@example.com', hashedPassword, 'ADMIN']
      );
      admin = result.rows[0];
    }

    console.log("✅ Admin user created successfully!");
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);
    console.log("\n⚠️  IMPORTANT: Change the default password after first login!");
    
    await pool.end();
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    await pool.end();
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
