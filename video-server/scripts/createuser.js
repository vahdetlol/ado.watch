import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function createuser() {
  try {
  // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');

    console.log('\n User creation\n');

    const username = await question('Username: ');
    const email = await question('Email: ');
    const password = await question('Password: ');
    const level = await question('Level (admin/moderator/user): ') || 'user';

  // Check if the user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      console.log('\n This nickname or email is already in use!');
      process.exit(1);
    }

  // Create a new user
    const user = new User({
      username,
      email,
      password,
      level,
      isActive: true
    });

    await user.save();

    console.log('\n✅ User created successfully!');
    console.log(`\nUser ID: ${user._id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Level: ${user.level}`);
    console.log(`Active: ${user.isActive}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  }
}

createuser();
