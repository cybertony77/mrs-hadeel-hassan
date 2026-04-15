const { MongoClient } = require('mongodb');

// Load environment variables from env.config
const fs = require('fs');
const path = require('path');

function loadEnvConfig() {
  try {
    const envPath = path.join(__dirname, '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, ''); // strip quotes
          envVars[key] = value;
        }
      }
    });

    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI =
  envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME =
  envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function addAccountState() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    console.log('🚀 Starting to add account_state field...');
    
    // Update students collection
    console.log('👨‍🎓 Updating students collection...');
    const studentsResult = await db.collection('students').updateMany(
      { account_state: { $exists: false } }, // Find documents without account_state field
      { $set: { account_state: 'Activated' } } // Add account_state: 'Activated'
    );
    console.log(`✅ Updated ${studentsResult.modifiedCount} students`);
    
    // Update assistants collection
    console.log('👥 Updating assistants collection...');
    const assistantsResult = await db.collection('assistants').updateMany(
      { account_state: { $exists: false } }, // Find documents without account_state field
      { $set: { account_state: 'Activated' } } // Add account_state: 'Activated'
    );
    console.log(`✅ Updated ${assistantsResult.modifiedCount} assistants`);
    
    // Also update any documents that have account_state but it's not 'Activated'
    console.log('🔄 Updating documents with non-Activated account_state...');
    
    const studentsUpdateResult = await db.collection('students').updateMany(
      { account_state: { $ne: 'Activated' } }, // Find documents where account_state is not 'Activated'
      { $set: { account_state: 'Activated' } } // Set account_state to 'Activated'
    );
    console.log(`✅ Updated ${studentsUpdateResult.modifiedCount} students with non-Activated status`);
    
    const assistantsUpdateResult = await db.collection('assistants').updateMany(
      { account_state: { $ne: 'Activated' } }, // Find documents where account_state is not 'Activated'
      { $set: { account_state: 'Activated' } } // Set account_state to 'Activated'
    );
    console.log(`✅ Updated ${assistantsUpdateResult.modifiedCount} assistants with non-Activated status`);
    
    // Get final counts
    const totalStudents = await db.collection('students').countDocuments();
    const totalAssistants = await db.collection('assistants').countDocuments();
    const activatedStudents = await db.collection('students').countDocuments({ account_state: 'Activated' });
    const activatedAssistants = await db.collection('assistants').countDocuments({ account_state: 'Activated' });
    
    console.log('\n🎉 Account state update completed successfully!');
    console.log('\n📊 Final Summary:');
    console.log(`- Total students: ${totalStudents}`);
    console.log(`- Students with 'Activated' status: ${activatedStudents}`);
    console.log(`- Total assistants: ${totalAssistants}`);
    console.log(`- Assistants with 'Activated' status: ${activatedAssistants}`);
    
    if (activatedStudents === totalStudents && activatedAssistants === totalAssistants) {
      console.log('✅ All students and assistants now have account_state: "Activated"');
    } else {
      console.log('⚠️  Some records may still need attention');
    }
    
  } catch (error) {
    console.error('❌ Error updating account state:', error);
  } finally {
    if (client) await client.close();
  }
}

// Run the script
addAccountState();
