const mongoose = require('mongoose');

const profSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  department: { type: String, required: true },
  role: { type: String, default: 'professor' }
}, { timestamps: true });

module.exports = mongoose.model('Professor', profSchema);
