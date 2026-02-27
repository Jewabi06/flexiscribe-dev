require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

async function main() {
  console.log("Starting admin database seed...");
  
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

    let adminUser;
    if (existingAdmin.rows.length > 0) {
      console.log("Admin user already exists...");
      adminUser = existingAdmin.rows[0];
    } else {
      // Create admin user
      const result = await pool.query(
        'INSERT INTO "User" (id, email, password, role, "phoneNumber", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()) RETURNING *',
        ['skyadmin@example.com', hashedPassword, 'ADMIN', '+63 912 345 6789']
      );
      adminUser = result.rows[0];
      console.log("✅ Admin user created!");
    }

    // Check if Admin profile exists
    const existingAdminProfile = await pool.query(
      'SELECT * FROM "Admin" WHERE "userId" = $1',
      [adminUser.id]
    );

    let adminProfile;
    if (existingAdminProfile.rows.length > 0) {
      console.log("Admin profile already exists...");
      adminProfile = existingAdminProfile.rows[0];
    } else {
      // Create Admin profile
      const result = await pool.query(
        'INSERT INTO "Admin" (id, username, "fullName", "userId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW()) RETURNING *',
        ['admin', 'System Administrator', adminUser.id]
      );
      adminProfile = result.rows[0];
      console.log("✅ Admin profile created!");
    }

    // Create sample notifications for admin
    const notificationCheck = await pool.query(
      'SELECT COUNT(*) as count FROM "Notification" WHERE "adminId" = $1',
      [adminProfile.id]
    );

    if (parseInt(notificationCheck.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO "Notification" (id, title, message, type, "adminId", "createdAt", "updatedAt") 
         VALUES 
         (gen_random_uuid(), 'Welcome to fLexiScribe', 'Your admin account has been successfully set up', 'info', $1, NOW(), NOW()),
         (gen_random_uuid(), 'System Update', 'The platform has been updated to the latest version', 'info', $1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
         (gen_random_uuid(), 'New User Registration', 'A new student has registered on the platform', 'info', $1, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours')`,
        [adminProfile.id]
      );
      console.log("✅ Sample notifications created!");
    }

    // Create sample activities
    const activityCheck = await pool.query('SELECT COUNT(*) as count FROM "Activity"');
    
    if (parseInt(activityCheck.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO "Activity" (id, action, description, "userRole", "userName", "userId", "createdAt") 
         VALUES 
         (gen_random_uuid(), 'System Initialized', 'Admin account created and system initialized', 'ADMIN', 'System', $1, NOW()),
         (gen_random_uuid(), 'User Login', 'Admin logged into the system', 'ADMIN', 'System Administrator', $1, NOW() - INTERVAL '1 hour')`,
        [adminUser.id]
      );
      console.log("✅ Sample activities created!");
    }

    // Create sample audit logs
    const auditCheck = await pool.query('SELECT COUNT(*) as count FROM "AuditLog"');
    
    if (parseInt(auditCheck.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO "AuditLog" (id, action, details, "userRole", "userName", "adminId", "userId", "createdAt") 
         VALUES 
         (gen_random_uuid(), 'System Setup', 'Initial system configuration completed', 'ADMIN', 'System Administrator', $1, $2, NOW()),
         (gen_random_uuid(), 'Admin Login', 'Administrator logged into the system', 'ADMIN', 'System Administrator', $1, $2, NOW() - INTERVAL '30 minutes')`,
        [adminProfile.id, adminUser.id]
      );
      console.log("✅ Sample audit logs created!");
    }

    console.log("\n📧 Admin Credentials:");
    console.log("Email: skyadmin@example.com");
    console.log("Password: skyadminacc0123");
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
