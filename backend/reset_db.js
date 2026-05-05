require('dotenv').config();
const mongoose = require('mongoose');
const Hall = require('./models/Hall');
const Professor = require('./models/Professor');
const Booking = require('./models/Booking');
const connectDB = require('./db/database');

async function resetDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected. Clearing collections...');
  await Hall.deleteMany({});
  await Professor.deleteMany({});
  await Booking.deleteMany({});
  console.log('Collections cleared.');
  
  // Close connection so server.js can run or we can just call connectDB logic
  await mongoose.disconnect();
  console.log('Re-running seeder via connectDB...');
  await connectDB();
  console.log('Done!');
  process.exit(0);
}

resetDB();
