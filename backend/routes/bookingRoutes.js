const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const BookingSlot = require('../models/BookingSlot');
const Hall = require('../models/Hall');

const bookingSlotIndexesReady = BookingSlot.init();

const toMin = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const isTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const todayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const nowMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};
const addDays = (date, days) => {
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
};
const durationMinutes = (startTime, endTime) => {
  const start = toMin(startTime);
  const end = toMin(endTime);
  if (start === end) return 0;
  return end > start ? end - start : (24 * 60 - start) + end;
};

const bookingEndDateTime = booking => {
  const [y, m, d] = booking.date.split('-').map(Number);
  const start = toMin(booking.startTime);
  const end = toMin(booking.endTime);
  const endDate = new Date(y, m - 1, d);
  if (end <= start) endDate.setDate(endDate.getDate() + 1);
  endDate.setHours(Math.floor(end / 60), end % 60, 0, 0);
  return endDate;
};

const buildMinuteSlots = (hallId, date, startTime, endTime, bookingId) => {
  const slots = [];
  const start = toMin(startTime);
  const duration = durationMinutes(startTime, endTime);

  for (let offset = 0; offset < duration; offset += 1) {
    const absoluteMinute = start + offset;
    slots.push({
      hallId,
      date: addDays(date, Math.floor(absoluteMinute / (24 * 60))),
      minute: absoluteMinute % (24 * 60),
      bookingId
    });
  }

  return slots;
};

async function hasConflict(hallId, date, startTime, endTime, excludeId = null) {
  const bookingId = excludeId || new mongoose.Types.ObjectId();
  const slots = buildMinuteSlots(hallId, date, startTime, endTime, bookingId);
  if (!slots.length) return false;
  const slotKey = slot => `${slot.date}|${slot.minute}`;
  const proposed = new Set(slots.map(slotKey));

  const query = {
    $or: slots.map(slot => ({ hallId: slot.hallId, date: slot.date, minute: slot.minute }))
  };
  if (excludeId) query.bookingId = { $ne: excludeId };

  if (await BookingSlot.exists(query)) return true;

  const bookingQuery = { hallId, status: { $ne: 'cancelled' } };
  if (excludeId) bookingQuery._id = { $ne: excludeId };
  const existing = await Booking.find(bookingQuery).lean();

  return existing.some(b => {
    const existingSlots = buildMinuteSlots(b.hallId, b.date, b.startTime, b.endTime, b._id);
    return existingSlots.some(slot => proposed.has(slotKey(slot)));
  });
}

async function reserveSlots(booking) {
  await bookingSlotIndexesReady;

  const slots = buildMinuteSlots(booking.hallId, booking.date, booking.startTime, booking.endTime, booking._id);

  try {
    await BookingSlot.insertMany(slots, { ordered: true });
    return true;
  } catch (err) {
    await BookingSlot.deleteMany({ bookingId: booking._id });
    if (err && err.code === 11000) return false;
    throw err;
  }
}

async function replaceReservedSlots(booking, nextValues) {
  const backup = await BookingSlot.find({ bookingId: booking._id }).lean();
  await BookingSlot.deleteMany({ bookingId: booking._id });

  const updatedBooking = {
    _id: booking._id,
    hallId: nextValues.hallId || booking.hallId,
    date: nextValues.date || booking.date,
    startTime: nextValues.startTime || booking.startTime,
    endTime: nextValues.endTime || booking.endTime
  };

  const reserved = await reserveSlots(updatedBooking);
  if (reserved) return true;

  if (backup.length) {
    const oldSlots = backup.map(({ _id, createdAt, updatedAt, __v, ...slot }) => slot);
    await BookingSlot.insertMany(oldSlots, { ordered: false });
  }

  return false;
}

router.get('/', async (req, res) => {
  try {
    const { hallId, date, professorId, upcoming } = req.query;
    let query = {};

    if (hallId) query.hallId = hallId;
    if (date) query.date = date;
    if (professorId) query.professorId = professorId;
    if (upcoming === 'true') query.status = { $ne: 'cancelled' };

    let data = await Booking.find(query).lean();
    if (upcoming === 'true') {
      const now = new Date();
      data = data.filter(booking => bookingEndDateTime(booking) > now);
    }
    
    // Enrich with hall info
    for (let b of data) {
      b.hall = await Hall.findById(b.hallId).lean();
    }

    data.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hall/:hallId', async (req, res) => {
  try {
    const { date } = req.query;
    let query = { hallId: req.params.hallId, status: { $ne: 'cancelled' } };
    if (date) query.date = date;
    
    let data = await Booking.find(query).sort({ date: 1, startTime: 1 });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/availability/:hallId', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'date query param required' });

    const hall = await Hall.findById(req.params.hallId);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });

    const previousDate = addDays(date, -1);
    const bookings = await Booking.find({
      hallId: req.params.hallId,
      status: { $ne: 'cancelled' },
      $or: [
        { date },
        { date: previousDate, $expr: { $lte: ['$endTime', '$startTime'] } }
      ]
    }).sort({ date: 1, startTime: 1 });
    res.json({ success: true, data: { hall, date, bookings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  let newBooking = null;
  try {
    const { hallId, date, startTime, endTime, professorId } = req.body;
    if (!hallId || !date || !startTime || !endTime || !professorId)
      return res.status(400).json({ success: false, message: 'hallId, date, startTime, endTime, and professorId are required' });
    if (!isTime(startTime) || !isTime(endTime))
      return res.status(400).json({ success: false, message: 'Start time and end time must be valid 24-hour times' });

    const hall = await Hall.findById(hallId);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });

    if (durationMinutes(startTime, endTime) === 0)
      return res.status(400).json({ success: false, message: 'Start and end time cannot be the same' });

    const today = todayStr();
    if (date < today)
      return res.status(400).json({ success: false, message: 'Cannot book for a past date' });
    if (date === today && toMin(startTime) <= nowMinutes())
      return res.status(400).json({ success: false, message: 'Cannot book a time that has already passed' });

    if (await hasConflict(hallId, date, startTime, endTime))
      return res.status(409).json({ success: false, message: `${hall.name} is already booked during that time slot` });

    newBooking = new Booking({ _id: new mongoose.Types.ObjectId(), ...req.body });

    const reserved = await reserveSlots(newBooking);
    if (!reserved)
      return res.status(409).json({ success: false, message: `${hall.name} is already booked during that time slot` });

    await newBooking.save();
    
    res.status(201).json({ success: true, data: newBooking, message: `${hall.name} booked successfully for ${date}` });
  } catch (err) {
    if (newBooking) await BookingSlot.deleteMany({ bookingId: newBooking._id }).catch(() => {});
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const newDate = req.body.date || booking.date;
    const newStart = req.body.startTime || booking.startTime;
    const newEnd = req.body.endTime || booking.endTime;
    if (!isTime(newStart) || !isTime(newEnd))
      return res.status(400).json({ success: false, message: 'Start time and end time must be valid 24-hour times' });

    if (durationMinutes(newStart, newEnd) === 0)
      return res.status(400).json({ success: false, message: 'Start and end time cannot be the same' });
    const today = todayStr();
    if (newDate < today)
      return res.status(400).json({ success: false, message: 'Cannot book for a past date' });
    if (newDate === today && toMin(newStart) <= nowMinutes())
      return res.status(400).json({ success: false, message: 'Cannot book a time that has already passed' });

    if (await hasConflict(booking.hallId, newDate, newStart, newEnd, req.params.id))
      return res.status(409).json({ success: false, message: 'Time slot conflicts with an existing booking' });

    const reserved = await replaceReservedSlots(booking, req.body);
    if (!reserved)
      return res.status(409).json({ success: false, message: 'Time slot conflicts with an existing booking' });

    const updated = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: updated, message: 'Booking updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'cancelled', cancelledAt: new Date() }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await BookingSlot.deleteMany({ bookingId: booking._id });
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.query.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Only admin can permanently delete bookings' });

    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    await BookingSlot.deleteMany({ bookingId: booking._id });
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
