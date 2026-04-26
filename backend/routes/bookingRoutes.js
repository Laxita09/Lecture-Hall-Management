const express = require('express');
const router  = express.Router();
const Booking = require('../models/Booking');
const Hall = require('../models/Hall');

// Helper: check time overlap
async function hasConflict(hallId, date, startTime, endTime, excludeId = null) {
  const query = { hallId, date, status: { $ne: 'cancelled' } };
  if (excludeId) query._id = { $ne: excludeId };

  const existing = await Booking.find(query);
  
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const newStart = toMin(startTime);
  const newEnd   = toMin(endTime);

  return existing.some(b => {
    const bStart = toMin(b.startTime);
    const bEnd   = toMin(b.endTime);
    return newStart < bEnd && newEnd > bStart; 
  });
}

router.get('/', async (req, res) => {
  try {
    const { hallId, date, professorId, upcoming } = req.query;
    let query = {};

    if (hallId) query.hallId = hallId;
    if (date) query.date = date;
    if (professorId) query.professorId = professorId;
    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query.date = { $gte: today };
      query.status = { $ne: 'cancelled' };
    }

    let data = await Booking.find(query).lean();
    
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

    const bookings = await Booking.find({ hallId: req.params.hallId, date, status: { $ne: 'cancelled' } }).sort({ startTime: 1 });
    res.json({ success: true, data: { hall, date, bookings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { hallId, date, startTime, endTime, professorId } = req.body;
    if (!hallId || !date || !startTime || !endTime || !professorId)
      return res.status(400).json({ success: false, message: 'hallId, date, startTime, endTime, and professorId are required' });

    const hall = await Hall.findById(hallId);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });

    if (startTime >= endTime)
      return res.status(400).json({ success: false, message: 'End time must be after start time' });

    const today = new Date().toISOString().split('T')[0];
    if (date < today)
      return res.status(400).json({ success: false, message: 'Cannot book for a past date' });

    if (await hasConflict(hallId, date, startTime, endTime))
      return res.status(409).json({ success: false, message: `${hall.name} is already booked during that time slot` });

    const newBooking = new Booking(req.body);
    await newBooking.save();
    
    res.status(201).json({ success: true, data: newBooking, message: `${hall.name} booked successfully for ${date}` });
  } catch (err) {
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

    if (newStart >= newEnd)
      return res.status(400).json({ success: false, message: 'End time must be after start time' });

    if (await hasConflict(booking.hallId, newDate, newStart, newEnd, req.params.id))
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
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Both admin and profs can hit this now
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
