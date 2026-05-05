const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  hallId: { type: String, required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  purpose: { type: String, default: '' },
  purposeType: { type: String, default: 'class' },
  professorId: { type: String, required: true },
  professorName: { type: String, required: true },
  bookedFor: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, default: 'confirmed' },
  cancelledAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
