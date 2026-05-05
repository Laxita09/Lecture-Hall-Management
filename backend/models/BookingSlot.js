const mongoose = require('mongoose');

const bookingSlotSchema = new mongoose.Schema({
  hallId: { type: String, required: true },
  date: { type: String, required: true },
  minute: { type: Number, required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Booking' }
}, { timestamps: true });

bookingSlotSchema.index({ hallId: 1, date: 1, minute: 1 }, { unique: true });
bookingSlotSchema.index({ bookingId: 1 });

module.exports = mongoose.model('BookingSlot', bookingSlotSchema);
