const mongoose = require('mongoose');
const Hall = require('../models/Hall');
const Professor = require('../models/Professor');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`\n🚀 MongoDB Connected: ${conn.connection.host}`);
    
    // Seed Halls
    const hallCount = await Hall.countDocuments();
    if (hallCount === 0) {
      const seedData = [
        { hall_id: 1,  name: 'Hall A-101', building: 'Academic Block', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 2,  name: 'Hall A-102', building: 'Academic Block', capacity: 80, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 3,  name: 'Hall A-201', building: 'Academic Block', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 4,  name: 'Hall A-202', building: 'Academic Block', capacity: 100, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 5,  name: 'Hall A-203', building: 'Academic Block', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 6,  name: 'Hall A-301', building: 'Academic Block', capacity: 80, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 7,  name: 'Hall A-302', building: 'Academic Block', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 8,  name: 'Hall A-303', building: 'Academic Block', capacity: 120, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 9,  name: 'Hall A-401', building: 'Academic Block', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 10, name: 'Hall A-402', building: 'Academic Block', capacity: 80, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 11, name: 'Hall M-101', building: 'Mechanical Department Building', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 12, name: 'Hall M-102', building: 'Mechanical Department Building', capacity: 80, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 13, name: 'Hall M-201', building: 'Mechanical Department Building', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 14, name: 'Hall M-202', building: 'Mechanical Department Building', capacity: 100, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 15, name: 'Hall M-301', building: 'Mechanical Department Building', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 16, name: 'Hall E-101', building: 'ERP Building', capacity: 50, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 17, name: 'Hall E-102', building: 'ERP Building', capacity: 60, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 18, name: 'Hall E-201', building: 'ERP Building', capacity: 80, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 19, name: 'Hall E-202', building: 'ERP Building', capacity: 100, facilities: ['Projector', 'Duct', 'Smart Board', 'Wi-Fi', 'Microphone', 'Blackboard'], status: 'Available', floor: 'First Floor' }
      ];
      await Hall.insertMany(seedData);
      console.log('🌱 Seeded 19 lecture halls into MongoDB');
    }

    const profCount = await Professor.countDocuments();
    if (profCount === 0) {
      const defaultProfs = [
        { username: 'prof.sharma', password: 'sharma123', name: 'Dr. Rajesh Sharma', department: 'Computer Science', role: 'professor' },
        { username: 'prof.mehta', password: 'mehta123', name: 'Dr. Priya Mehta', department: 'Mechanical', role: 'professor' },
        { username: 'prof.verma', password: 'verma123', name: 'Prof. Ankit Verma', department: 'ERP & Management', role: 'professor' },
        { username: 'prof.gupta', password: 'gupta123', name: 'Dr. Sunita Gupta', department: 'Electronics', role: 'professor' },
        { username: 'admin', password: 'admin123', name: 'Admin', department: 'Administration', role: 'admin' },
      ];
      await Professor.insertMany(defaultProfs);
      console.log('🌱 Seeded 5 professor accounts into MongoDB');
    }

  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
