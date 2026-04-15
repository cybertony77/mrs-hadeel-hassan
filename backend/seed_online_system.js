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

async function ensureCollectionsExist(db) {
  console.log('🔍 Checking if collections exist...');
  
  // Get list of existing collections
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(col => col.name);
  
  // Check and rename assistants to users if it exists
  if (collectionNames.includes('assistants')) {
    console.log('🔄 Renaming assistants collection to users...');
    try {
      await db.collection('assistants').rename('users');
      console.log('✅ Successfully renamed assistants to users');
    } catch (error) {
      console.error('❌ Error renaming assistants collection:', error);
      // If rename fails (collection already exists), copy data instead
      if (error.codeName === 'NamespaceExists') {
        console.log('⚠️  Users collection already exists. Copying data from assistants...');
        const assistantsData = await db.collection('assistants').find({}).toArray();
        if (assistantsData.length > 0) {
          await db.collection('users').insertMany(assistantsData);
          console.log(`✅ Copied ${assistantsData.length} documents from assistants to users`);
        }
        await db.collection('assistants').drop();
        console.log('✅ Dropped assistants collection');
      }
    }
  }
  
  // Check and create VAC collection if it doesn't exist
  if (!collectionNames.includes('VAC')) {
    console.log('🔐 Creating VAC collection...');
    await db.createCollection('VAC');
    console.log('✅ VAC collection created');
  } else {
    console.log('✅ VAC collection already exists');
  }
  
  // Check and create VVC collection if it doesn't exist
  if (!collectionNames.includes('VVC')) {
    console.log('🎥 Creating VVC collection...');
    await db.createCollection('VVC');
    console.log('✅ VVC collection created');
  } else {
    console.log('✅ VVC collection already exists');
  }
  
  // Check and create homeworks collection if it doesn't exist
  if (!collectionNames.includes('homeworks')) {
    console.log('📝 Creating homeworks collection...');
    await db.createCollection('homeworks');
    console.log('✅ Homeworks collection created');
  } else {
    console.log('✅ Homeworks collection already exists');
  }
  
  // Check and create quizzes collection if it doesn't exist
  if (!collectionNames.includes('quizzes')) {
    console.log('📊 Creating quizzes collection...');
    await db.createCollection('quizzes');
    console.log('✅ Quizzes collection created');
  } else {
    console.log('✅ Quizzes collection already exists');
  }
  
  // Check and create online_sessions collection if it doesn't exist
  if (!collectionNames.includes('online_sessions')) {
    console.log('📹 Creating online_sessions collection...');
    await db.createCollection('online_sessions');
    console.log('✅ Online sessions collection created');
  } else {
    console.log('✅ Online sessions collection already exists');
  }
  
}

async function seedDatabase() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Ensure collections exist and rename assistants if needed
    await ensureCollectionsExist(db);
    
    console.log('🗑️ Clearing existing data from online system collections...');
    await db.collection('VAC').deleteMany({});
    await db.collection('VVC').deleteMany({});
    await db.collection('homeworks').deleteMany({});
    await db.collection('quizzes').deleteMany({});
    await db.collection('online_sessions').deleteMany({});
    
    console.log('✅ Collections cleared');
    
    // Helper function to generate VAC code (7 chars: 3 numbers, 2 uppercase, 2 lowercase)
    const generateVACCode = () => {
      const numbers = '0123456789';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      
      // Generate 3 random numbers
      const numPart = Array.from({ length: 3 }, () => 
        numbers[Math.floor(Math.random() * numbers.length)]
      ).join('');
      
      // Generate 2 random uppercase letters
      const upperPart = Array.from({ length: 2 }, () => 
        uppercase[Math.floor(Math.random() * uppercase.length)]
      ).join('');
      
      // Generate 2 random lowercase letters
      const lowerPart = Array.from({ length: 2 }, () => 
        lowercase[Math.floor(Math.random() * lowercase.length)]
      ).join('');
      
      // Combine and shuffle to randomize order
      const code = (numPart + upperPart + lowerPart).split('');
      for (let i = code.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [code[i], code[j]] = [code[j], code[i]];
      }
      
      return code.join('');
    };
    
    // Helper function to generate VVC code (9 chars: 5 numbers, 2 uppercase, 2 lowercase)
    const generateVVCCode = () => {
      const numbers = '0123456789';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      
      // Generate 5 random numbers
      const numPart = Array.from({ length: 5 }, () => 
        numbers[Math.floor(Math.random() * numbers.length)]
      ).join('');
      
      // Generate 2 random uppercase letters
      const upperPart = Array.from({ length: 2 }, () => 
        uppercase[Math.floor(Math.random() * uppercase.length)]
      ).join('');
      
      // Generate 2 random lowercase letters
      const lowerPart = Array.from({ length: 2 }, () => 
        lowercase[Math.floor(Math.random() * lowercase.length)]
      ).join('');
      
      // Combine and shuffle to randomize order
      const code = (numPart + upperPart + lowerPart).split('');
      for (let i = code.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [code[i], code[j]] = [code[j], code[i]];
      }
      
      return code.join('');
    };
    
    // Helper function to format date as MM/DD/YYYY at hour:minute AM/PM
    const formatDate = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const hoursStr = String(hours).padStart(2, '0');
      
      return `${month}/${day}/${year} at ${hoursStr}:${minutes} ${ampm}`;
    };

    // Create verification accounts codes collection
    console.log('🔐 Creating verification accounts codes...');
    const verificationCodes = [];
    for (let account_id = 1; account_id <= 10; account_id++) {
      const code = generateVACCode();
      // Shuffle the code again for extra randomness
      const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');
      
      verificationCodes.push({
        account_id: account_id,
        VAC: shuffledCode,
        VAC_activated: false
      });
    }
    await db.collection('VAC').insertMany(verificationCodes);
    console.log(`✅ Created ${verificationCodes.length} verification account codes`);

    // Create verification video codes collection
    console.log('🎥 Creating verification video codes...');
    const verificationVideoCodes = [];
    for (let i = 1; i <= 10; i++) {
      const code = generateVVCCode();
      const currentDate = new Date();
      const formattedDate = formatDate(currentDate);
      
      verificationVideoCodes.push({
        VVC: code,
        number_of_views: Math.floor(Math.random() * 3) + 1, // Random 1-3
        viewed: false,
        viewed_by_who: null,
        code_state: 'Activated',
        payment_state: 'Not Paid',
        made_by_who: 'tony',
        date: formattedDate
      });
    }
    await db.collection('VVC').insertMany(verificationVideoCodes);
    console.log(`✅ Created ${verificationVideoCodes.length} verification video codes`);

    console.log('🎉 Online system database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${verificationCodes.length} verification account codes (VAC) created`);
    console.log(`- ${verificationVideoCodes.length} verification video codes (VVC) created`);
    console.log('- Online sessions collection created (empty)');
    console.log('- Online homeworks collection created (empty)');
    console.log('- Online quizzes collection created (empty)');
    
  } catch (error) {
    console.error('❌ Error seeding online system database:', error);
    throw error;
  } finally {
    if (client) await client.close();
  }
}

seedDatabase();

