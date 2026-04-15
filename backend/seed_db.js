import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvConfig() {
  try {
    const envPath = path.join(__dirname, '..', 'env.config');
    
    // Check if file exists
    if (!fs.existsSync(envPath)) {
      console.log(`⚠️  env.config not found at: ${envPath}`);
      console.log('   Using process.env as fallback');
      return {};
    }
    
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

    console.log('✅ Successfully loaded env.config');
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config:', error.message);
    console.log('   Using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI =
  envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME =
  envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI not found in env.config');
}

console.log('🔗 Using Mongo URI:', MONGO_URI.replace(/\/\/.*@/, '//****@'));

// Lessons list (used for seeding the lessons collection in database)
const lessons = [
  'Subject and Verb Agreement',
  'Verb Tenses',
  'if conditionals and Pronouns',
  'Comparison and Superlative and Parallel Structure',
  'Modifiers',
  'Transition Words',
  'Punctuation Marks Part 1',
  'Punctuation Marks Part 2',
  'Rhetorical Synthesis',
  'Main Ideas',
  'Making Inferences',
  'Command of Evidence - Graphs',
  'Command of Evidence - Support and Weaken',
  'Cross-Text Connections',
  'Text, Structure, and Purpose',
  'Words in Context - Gap Filling - Synonyms',
  'Supporting Evidence and Examples, Topic, Conclusion, and Transition Sentences',
  'Sentence Placement',
  'Relevance and Purpose',
  'Boundaries',
  'Form, Structure, and Sense',
  'Details Question',
  'Main Purpose',
  'Overall Structure',
  'Underlined Purpose'
];

function createLessonsObject() {
  // Create an empty lessons object - lessons will be added as students attend
  return {};
}

async function ensureCollectionsExist(db) {
  console.log('🔍 Checking if collections exist...');
  
  // Get list of existing collections
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(col => col.name);
  
  // Check and create students collection if it doesn't exist
  if (!collectionNames.includes('students')) {
    console.log('📚 Creating students collection...');
    await db.createCollection('students');
    console.log('✅ Students collection created');
  } else {
    console.log('✅ Students collection already exists');
  }
  
  // Check and create users collection if it doesn't exist
  if (!collectionNames.includes('users')) {
    console.log('👥 Creating users collection...');
    await db.createCollection('users');
    console.log('✅ Users collection created');
  } else {
    console.log('✅ Users collection already exists');
  }
  
  // Check and create history collection if it doesn't exist
  if (!collectionNames.includes('history')) {
    console.log('📖 Creating history collection...');
    await db.createCollection('history');
    console.log('✅ History collection created');
  } else {
    console.log('✅ History collection already exists');
  }
  
  // Check and create centers collection if it doesn't exist
  if (!collectionNames.includes('centers')) {
    console.log('🏢 Creating centers collection...');
    await db.createCollection('centers');
    console.log('✅ Centers collection created');
  } else {
    console.log('✅ Centers collection already exists');
  }

  // Check and create lessons collection if it doesn't exist
  if (!collectionNames.includes('lessons')) {
    console.log('📚 Creating lessons collection...');
    await db.createCollection('lessons');
    console.log('✅ Lessons collection created');
  } else {
    console.log('✅ Lessons collection already exists');
  }

  // Check and create subscription collection if it doesn't exist
  if (!collectionNames.includes('subscription')) {
    console.log('🧾 Creating subscription collection...');
    await db.createCollection('subscription');
    console.log('✅ Subscription collection created');
  } else {
    console.log('✅ Subscription collection already exists');
  }

  // Check and create verification accounts codes collection if it doesn't exist
  if (!collectionNames.includes('VAC')) {
    console.log('🔐 Creating verification accounts codes collection...');
    await db.createCollection('VAC');
    console.log('✅ Verification accounts codes collection created');
  } else {
    console.log('✅ Verification accounts codes collection already exists');
  }

  // Check and create online sessions collection if it doesn't exist
  if (!collectionNames.includes('online_sessions')) {
    console.log('📹 Creating online sessions collection...');
    await db.createCollection('online_sessions');
    console.log('✅ Online sessions collection created');
  } else {
    console.log('✅ Online sessions collection already exists');
  }

  // Check and create verification video codes collection if it doesn't exist
  if (!collectionNames.includes('VVC')) {
    console.log('🎥 Creating verification video codes collection...');
    await db.createCollection('VVC');
    console.log('✅ Verification video codes collection created');
  } else {
    console.log('✅ Verification video codes collection already exists');
  }

  // Check and create verification homework codes collection if it doesn't exist
  if (!collectionNames.includes('VHC')) {
    console.log('📚 Creating verification homework codes collection...');
    await db.createCollection('VHC');
    console.log('✅ Verification homework codes collection created');
  } else {
    console.log('✅ Verification homework codes collection already exists');
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

  // Check and create scoring_conditions collection if it doesn't exist
  if (!collectionNames.includes('scoring_system_conditions')) {
    console.log('📋 Creating scoring_system_conditions collection...');
    await db.createCollection('scoring_system_conditions');
    console.log('✅ Scoring system conditions collection created');
  } else {
    console.log('✅ Scoring system conditions collection already exists');
  }

  // Check and create scoring_system_history collection if it doesn't exist
  if (!collectionNames.includes('scoring_system_history')) {
    console.log('📊 Creating scoring_system_history collection...');
    await db.createCollection('scoring_system_history');
    console.log('✅ Scoring system history collection created');
  } else {
    console.log('✅ Scoring system history collection already exists');
  }

  // Check and create homeworks_videos collection if it doesn't exist
  if (!collectionNames.includes('homeworks_videos')) {
    console.log('🎬 Creating homeworks_videos collection...');
    await db.createCollection('homeworks_videos');
    console.log('✅ Homeworks videos collection created');
  } else {
    console.log('✅ Homeworks videos collection already exists');
  }

  // Check and create join_whatsapp_group collection if it doesn't exist
  if (!collectionNames.includes('join_whatsapp_group')) {
    console.log('💬 Creating join_whatsapp_group collection...');
    await db.createCollection('join_whatsapp_group');
    console.log('✅ Join WhatsApp group collection created');
  } else {
    console.log('✅ Join WhatsApp group collection already exists');
  }

  // Check and create join_zoom_meeting collection if it doesn't exist
  if (!collectionNames.includes('join_zoom_meeting')) {
    console.log('🎦 Creating join_zoom_meeting collection...');
    await db.createCollection('join_zoom_meeting');
    console.log('✅ Join Zoom Meeting collection created');
  } else {
    console.log('✅ Join Zoom Meeting collection already exists');
  }

  // Check and create mock_exams collection if it doesn't exist
  if (!collectionNames.includes('mock_exams')) {
    console.log('📝 Creating mock_exams collection...');
    await db.createCollection('mock_exams');
    console.log('✅ Mock exams collection created');
  } else {
    console.log('✅ Mock exams collection already exists');
  }
}

async function seedDatabase() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Ensure collections exist before proceeding
    await ensureCollectionsExist(db);
    
    console.log('🗑️ Clearing existing data...');
    await db.collection('students').deleteMany({});
    await db.collection('users').deleteMany({});
    await db.collection('history').deleteMany({});
    await db.collection('centers').deleteMany({});
    await db.collection('lessons').deleteMany({});
    await db.collection('subscription').deleteMany({});
    await db.collection('VAC').deleteMany({});
    await db.collection('online_sessions').deleteMany({});
    await db.collection('VVC').deleteMany({});
    await db.collection('VHC').deleteMany({});
    await db.collection('homeworks').deleteMany({});
    await db.collection('quizzes').deleteMany({});
    await db.collection('scoring_system_conditions').deleteMany({});
    await db.collection('scoring_system_history').deleteMany({});
    await db.collection('homeworks_videos').deleteMany({});
    await db.collection('join_whatsapp_group').deleteMany({});
    await db.collection('join_zoom_meeting').deleteMany({});
    await db.collection('mock_exams').deleteMany({});
    
    console.log('✅ Database cleared');
    
    // Helper function to generate phone number in format 012 + 8 random digits
    const generatePhoneNumber = () => {
      const randomDigits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      return '012' + randomDigits;
    };

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

    // Helper function to generate VHC code (9 chars: 5 numbers, 2 uppercase, 2 lowercase)
    const generateVHCCode = () => {
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
    
    // Create users (assistants/admin/developer) with unique passwords
    const assistants = [
      {
        id: 'tony',
        name: 'Tony Joseph',
        phone: "201211172756",
        email: 'tony.joseph.business1717@gmail.com',
        role: 'developer',
        password: await bcrypt.hash('tony', 10),
        account_state: 'Activated'
      }
    ];
    
    console.log('👥 Creating users...');
    await db.collection('users').insertMany(assistants);
    console.log(`✅ Created ${assistants.length} users`);
    
    // Create centers collection with data from centers.js
    const centersData = [
      { id: 1, name: 'Online', location: '', grades: [], createdAt: new Date() },
    ];
    
    console.log('🏢 Creating centers...');
    if (centersData.length > 0) {
      await db.collection('centers').insertMany(centersData);
      console.log(`✅ Created ${centersData.length} centers`);
    } else {
      console.log('✅ No centers to create (array is empty)');
    }
    
    // Create lessons collection with default lessons
    const lessonsData = lessons.map((lessonName, index) => ({
      id: index + 1,
      name: lessonName,
      createdAt: new Date()
    }));
    
    console.log('📚 Creating lessons...');
    if (lessonsData.length > 0) {
      await db.collection('lessons').insertMany(lessonsData);
      console.log(`✅ Created ${lessonsData.length} lessons`);
    } else {
      console.log('✅ No lessons to create (array is empty)');
    }
    
    const students = [];
    const centers = [
      'Online'
    ];
    const grades = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
    const genders = ['Male', 'Female'];
    const courses = ['SAT', 'ACT', 'EST'];
    const courseTypes = ['basics', 'advanced'];
    
    for (let i = 1; i <= 2; i++) {
      const center = centers[Math.floor(Math.random() * centers.length)];
      const lessonsObj = createLessonsObject();
      
      students.push({
        id: i,
        name: faker.person.fullName(),
        age: Math.floor(Math.random() * 6) + 10,
        gender: genders[Math.floor(Math.random() * genders.length)],
        grade: grades[Math.floor(Math.random() * grades.length)],
        course: courses[Math.floor(Math.random() * courses.length)], // or get from grade
        courseType: courseTypes[Math.floor(Math.random() * courseTypes.length)],
        school: faker.company.name() + ' School',
        phone: generatePhoneNumber(),
        parentsPhone: generatePhoneNumber(),
        main_center: center,
        main_comment: null,
        account_state: 'Activated',
        score: 0,
        lessons: lessonsObj, // Empty object, lessons will be added as students attend
        payment: {
          numberOfSessions: 0,
          cost: 0,
          paymentComment: null,
          date: null
        },
        online_sessions: [],
        online_homeworks: [],
        online_quizzes: [],
        online_mock_exams: [],
        mockExams: Array(50).fill(null).map(() => ({
          examDegree: null,
          outOf: null,
          percentage: null,
          date: null
        })),
      });
    }
    
    console.log('👨‍🎓 Creating students...');
    if (students.length > 0) {
      await db.collection('students').insertMany(students);
      console.log(`✅ Created ${students.length} students`);
    } else {
      console.log('✅ No students to create (array is empty)');
    }

    // Initialize subscription collection with default document
    console.log('🧾 Initializing subscription collection...');
    const subscriptionDoc = {
      subscription_duration: null,
      date_of_subscription: null,
      date_of_expiration: null,
      cost: null,
      note: null,
      active: false
    };
    await db.collection('subscription').insertOne(subscriptionDoc);
    console.log('✅ Subscription collection initialized with default document');
    
    // Seed scoring system conditions
    console.log('📋 Seeding scoring system conditions...');
    const scoringConditions = [
      {
        type: "attendance",
        rules: [
          { key: "attend", points: 10 },
          { key: "absent", points: -5 }
        ]
      },
      {
        type: "homework",
        withDegree: true,
        rules: [
          { min: 100, max: 100, points: 20 },
          { min: 75, max: 99, points: 15 },
          { min: 50, max: 74, points: 10 },
          { min: 1, max: 49, points: 5 },
          { min: 0, max: 0, points: -20 }
        ],
        bonusRules: [
          {
            key: "four_100_hw_streak",
            condition: {
              lastN: 4,
              percentage: 100
            },
            points: 25
          }
        ]
      },
      {
        type: "homework",
        withDegree: false,
        rules: [
          { hwDone: true, points: 20 },
          { hwDone: "Not Completed", points: 10 },
          { hwDone: false, points: -20 }
        ]
      },
      {
        _id: "quiz",
        type: "quiz",
        rules: [
          { min: 100, max: 100, points: 25 },
          { min: 75, max: 99, points: 20 },
          { min: 50, max: 74, points: 15 },
          { min: 20, max: 49, points: 10 },
          { min: 1, max: 19, points: 5 },
          { min: 0, max: 0, points: -25 }
        ],
        bonusRules: [
          {
            key: "four_100_streak",
            condition: {
              lastN: 4,
              percentage: 100
            },
            points: 30
          }
        ]
      },
      {
        _id: "mock-exam",
        type: "mock-exam",
        rules: [
          { min: 100, max: 100, points: 35 },
          { min: 75, max: 99, points: 25 },
          { min: 50, max: 74, points: 20 },
          { min: 20, max: 49, points: 15 },
          { min: 1, max: 19, points: 10 },
          { min: 0, max: 0, points: -25 }
        ],
        bonusRules: [
          {
            key: "four_100_streak",
            condition: {
              lastN: 4,
              percentage: 100
            },
            points: 50
          }
        ]
      }
    ];
    await db.collection('scoring_system_conditions').insertMany(scoringConditions);
    console.log(`✅ Created ${scoringConditions.length} scoring system conditions`);
    
    // Initialize scoring_system_history collection (empty, will be populated as students perform actions)
    console.log('📊 Initializing scoring_system_history collection...');
    console.log('✅ Scoring system history collection initialized (empty)');
    
    // Initialize homeworks_videos collection (empty, will be populated by admin)
    console.log('🎬 Initializing homeworks_videos collection...');
    console.log('✅ Homeworks videos collection initialized (empty)');
    
    // Initialize join_whatsapp_group collection (empty, will be populated by admin)
    console.log('💬 Initializing join_whatsapp_group collection...');
    console.log('✅ Join WhatsApp group collection initialized (empty)');
    
    // Initialize join_zoom_meeting collection (empty, will be populated by admin)
    console.log('🎦 Initializing join_zoom_meeting collection...');
    console.log('✅ Join Zoom Meeting collection initialized (empty)');
    
    // Initialize mock_exams collection (empty, will be populated by admin)
    console.log('📝 Initializing mock_exams collection...');
    console.log('✅ Mock exams collection initialized (empty)');

    // Create verification accounts codes collection
    console.log('🔐 Creating verification accounts codes...');
    const verificationCodes = [];
    // for (let account_id = 1; account_id <= 10; account_id++) {
    //   const code = generateVACCode();
    //   // Shuffle the code again for extra randomness
    //   const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');
      
    //   verificationCodes.push({
    //     account_id: account_id,
    //     VAC: shuffledCode,
    //     VAC_activated: false
    //   });
    // }
    if (verificationCodes.length > 0) {
      await db.collection('VAC').insertMany(verificationCodes);
      console.log(`✅ Created ${verificationCodes.length} verification account codes`);
    } else {
      console.log('✅ No verification account codes to create (array is empty)');
    }

    // Create verification video codes collection
    console.log('🎥 Creating verification video codes...');
    const verificationVideoCodes = [];
    // for (let i = 1; i <= 10; i++) {
    //   const code = generateVVCCode();
    //   const currentDate = new Date();
    //   const formattedDate = formatDate(currentDate);
      
    //   verificationVideoCodes.push({
    //     VVC: code,
    //     number_of_views: Math.floor(Math.random() * 3) + 1, // Random 1-3
    //     viewed: false,
    //     viewed_by_who: null,
    //     code_state: 'Activated',
    //     payment_state: 'Not Paid',
    //     made_by_who: 'tony',
    //     date: formattedDate
    //   });
    // }
    if (verificationVideoCodes.length > 0) {
      await db.collection('VVC').insertMany(verificationVideoCodes);
      console.log(`✅ Created ${verificationVideoCodes.length} verification video codes`);
    } else {
      console.log('✅ No verification video codes to create (array is empty)');
    }

    // Create verification homework codes collection
    console.log('📚 Creating verification homework codes...');
    const verificationHomeworkCodes = [];
    // for (let i = 1; i <= 10; i++) {
    //   const code = generateVHCCode();
    //   const currentDate = new Date();
    //   const formattedDate = formatDate(currentDate);
      
    //   verificationHomeworkCodes.push({
    //     VHC: code,
    //     number_of_views: Math.floor(Math.random() * 3) + 1, // Random 1-3
    //     viewed: false,
    //     viewed_by_who: null,
    //     code_state: 'Activated',
    //     payment_state: 'Not Paid',
    //     made_by_who: 'tony',
    //     date: formattedDate
    //   });
    // }
    if (verificationHomeworkCodes.length > 0) {
      await db.collection('VHC').insertMany(verificationHomeworkCodes);
      console.log(`✅ Created ${verificationHomeworkCodes.length} verification homework codes`);
    } else {
      console.log('✅ No verification homework codes to create (array is empty)');
    }

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${assistants.length} assistants created`);
    console.log(`- ${students.length} students created`);
    console.log(`- ${centersData.length} centers created`);
    console.log(`- ${lessonsData.length} lessons created`);
    console.log('- History collection cleared (no initial records)');
    console.log('- Subscription collection initialized with default document');
    console.log(`- ${verificationCodes.length} verification account codes created`);
    console.log(`- ${verificationVideoCodes.length} verification video codes created`);
    console.log(`- ${verificationHomeworkCodes.length} verification homework codes created`);
    console.log('- Online sessions collection cleared (no initial records)');
    console.log('- Homeworks collection cleared (no initial records)');
    console.log('- Quizzes collection cleared (no initial records)');
    console.log(`- ${scoringConditions.length} scoring system conditions created`);
    console.log('- Scoring system history collection initialized (empty)');
    console.log('- Homeworks videos collection initialized (empty)');
    console.log('- Join WhatsApp group collection initialized (empty)');
    console.log('- Mock exams collection initialized (empty)');
    console.log('- Join Zoom Meeting collection initialized (empty)');
    console.log('\n🔑 Demo Login Credentials:');
    console.log('Admin ID: admin, Password: admin');
    console.log('Tony ID: tony, Password: tony');
    console.log('Assistant 1 ID: assistant1, Password: assistant');
    console.log('Assistant 2 ID: assistant2, Password: assistant');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    if (client) await client.close();
  }
}

seedDatabase();