const mongoose = require('mongoose');
const Hall = require('../models/Hall');
const Professor = require('../models/Professor');
const Booking = require('../models/Booking');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`\nMongoDB Connected: ${conn.connection.host}`);
    
    // Seed Halls
    const hallCount = await Hall.countDocuments();
    if (hallCount === 0) {
      const seedData = [
        { hall_id: 1,  name: 'LT-1', building: 'Academic Block', capacity: 200, facilities: ['Projector', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 2,  name: 'LT-2', building: 'Academic Block', capacity: 200, facilities: ['Projector', 'Wi-Fi', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 3,  name: 'LT-3', building: 'Academic Block', capacity: 100, facilities: ['Smart Board', 'Wi-Fi'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 4,  name: 'LT-4', building: 'Academic Block', capacity: 100, facilities: ['Projector', 'Smart Board', 'Microphone', 'Wi-Fi'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 5,  name: 'LT-5', building: 'Academic Block', capacity: 100, facilities: ['Blackboard', 'Duct'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 6,  name: 'LT-6', building: 'Academic Block', capacity: 100, facilities: ['Projector', 'Duct', 'Wi-Fi'], status: 'Available', floor: 'First Floor' },
        { hall_id: 7,  name: 'LT-7', building: 'Academic Block', capacity: 100, facilities: ['Smart Board', 'Blackboard'], status: 'Available', floor: 'First Floor' },
        { hall_id: 8,  name: 'LT-8', building: 'Academic Block', capacity: 100, facilities: ['Projector', 'Smart Board', 'Microphone', 'Duct', 'Wi-Fi'], status: 'Available', floor: 'First Floor' },
        { hall_id: 9,  name: 'LT-9', building: 'Academic Block', capacity: 200, facilities: ['Projector', 'Blackboard', 'Microphone'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 10, name: 'LT-10', building: 'Academic Block', capacity: 200, facilities: ['Smart Board', 'Wi-Fi', 'Duct'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 11, name: 'LT-11', building: 'Mechanical Department Building', capacity: 60, facilities: ['Projector', 'Blackboard'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 12, name: 'LT-12', building: 'Mechanical Department Building', capacity: 80, facilities: ['Projector', 'Duct', 'Wi-Fi'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 13, name: 'LT-13', building: 'Mechanical Department Building', capacity: 60, facilities: ['Blackboard', 'Microphone'], status: 'Available', floor: 'First Floor' },
        { hall_id: 14, name: 'LT-14', building: 'Mechanical Department Building', capacity: 100, facilities: ['Projector', 'Smart Board', 'Microphone'], status: 'Available', floor: 'First Floor' },
        { hall_id: 15, name: 'LT-15', building: 'Mechanical Department Building', capacity: 60, facilities: ['Smart Board', 'Wi-Fi'], status: 'Available', floor: 'First Floor' },
        { hall_id: 16, name: 'LT-16', building: 'ERP Building', capacity: 200, facilities: ['Projector', 'Duct'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 17, name: 'LT-17', building: 'ERP Building', capacity: 200, facilities: ['Blackboard', 'Wi-Fi'], status: 'Available', floor: 'Ground Floor' },
        { hall_id: 18, name: 'LT-18', building: 'ERP Building', capacity: 150, facilities: ['Projector', 'Smart Board', 'Duct', 'Wi-Fi'], status: 'Available', floor: 'First Floor' },
        { hall_id: 19, name: 'LT-19', building: 'ERP Building', capacity: 200, facilities: ['Projector', 'Smart Board', 'Microphone', 'Blackboard', 'Duct', 'Wi-Fi'], status: 'Available', floor: 'First Floor' }
      ];
      await Hall.insertMany(seedData);
      console.log('Seeded 19 lecture halls into MongoDB');
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
      console.log('Seeded 5 professor accounts into MongoDB');
    }

    const bookingCount = await Booking.countDocuments();
    if (bookingCount === 0) {
      const prof1 = await Professor.findOne({ username: 'prof.sharma' });
      const prof2 = await Professor.findOne({ username: 'prof.mehta' });
      const hall1 = await Hall.findOne({ hall_id: 1 });
      const hall2 = await Hall.findOne({ hall_id: 2 });
      const hall3 = await Hall.findOne({ hall_id: 11 });

      if (prof1 && prof2 && hall1 && hall2 && hall3) {
        const today = new Date().toISOString().split('T')[0];
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
        const tmrwStr = tmrw.toISOString().split('T')[0];

        const seedBookings = [
          { hallId: hall1._id, date: today, startTime: '10:00', endTime: '12:00', purposeType: 'class', professorId: prof1._id, professorName: prof1.name, bookedFor: 'Data Structures', status: 'confirmed' },
          { hallId: hall2._id, date: today, startTime: '14:00', endTime: '16:00', purposeType: 'club', professorId: prof2._id, professorName: prof2.name, bookedFor: 'Robotics Club', status: 'confirmed' },
          { hallId: hall3._id, date: tmrwStr, startTime: '09:00', endTime: '11:00', purposeType: 'exam', professorId: prof1._id, professorName: prof1.name, bookedFor: 'Midterm Exam', status: 'confirmed' }
        ];
        await Booking.insertMany(seedBookings);
        console.log('Seeded 3 bookings into MongoDB');
      }
    }

  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
