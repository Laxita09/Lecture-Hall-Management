const mongoose = require('mongoose');

const hallSchema = new mongoose.Schema({
  hall_id: { type: Number, required: true, unique: true },
  name: { type: String, required: true },
  building: { type: String, required: true },
  capacity: { type: Number, required: true },
  facilities: [{ type: String }],
  status: { type: String, default: 'Available' },
  floor: { type: String, default: '' },
  description: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Hall', hallSchema);
