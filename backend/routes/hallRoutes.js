const express = require('express');
const router = express.Router();
const Hall = require('../models/Hall');
const Booking = require('../models/Booking');
const BookingSlot = require('../models/BookingSlot');

function requireAdmin(req, res) {
  if (req.query.role === 'admin') return false;
  res.status(403).json({ success: false, message: 'Only admin can perform this action' });
  return true;
}

const todayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const toMin = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
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

const isBookingActiveNow = (booking, date, minute) => {
  const start = toMin(booking.startTime);
  const end = toMin(booking.endTime);

  if (end > start) return booking.date === date && minute >= start && minute < end;

  return (booking.date === date && minute >= start) ||
    (addDays(booking.date, 1) === date && minute < end);
};

async function markCurrentOccupancy(halls) {
  const date = todayStr();
  const minute = nowMinutes();
  const hallIds = halls.map(h => String(h._id));

  const occupiedSlots = await BookingSlot.find({
    hallId: { $in: hallIds },
    date,
    minute
  }).distinct('hallId');

  const occupiedSet = new Set(occupiedSlots.map(String));
  const yesterday = addDays(date, -1);
  const activeBookings = await Booking.find({
    hallId: { $in: hallIds },
    status: { $ne: 'cancelled' },
    date: { $in: [yesterday, date] }
  }).lean();

  activeBookings.forEach(booking => {
    if (isBookingActiveNow(booking, date, minute)) occupiedSet.add(String(booking.hallId));
  });

  return halls.map(hall => ({
    ...hall,
    status: occupiedSet.has(String(hall._id)) ? 'Occupied' : 'Available'
  }));
}

router.get('/', async (req, res) => {
  try {
    const { building, status, capacity, facility, search } = req.query;
    let query = {};
    if (building) query.building = building;
    if (capacity) query.capacity = { $gte: Number(capacity) };
    if (facility) query.facilities = facility;
    if (search) {
      const q = new RegExp(search, 'i');
      query.$or = [{ name: q }, { building: q }, { description: q }];
    }

    let data = await Hall.find(query).sort({ hall_id: 1 }).lean();
    data = await markCurrentOccupancy(data);
    if (status) data = data.filter(hall => hall.status === status);

    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/meta/stats', async (req, res) => {
  try {
    const halls = await markCurrentOccupancy(await Hall.find({}).lean());
    const total = halls.length;
    const available = halls.filter(h => h.status === 'Available').length;
    const occupied = total - available;

    const byBuilding = Object.values(halls.reduce((acc, hall) => {
      acc[hall.building] ||= { _id: hall.building, count: 0, available: 0 };
      acc[hall.building].count += 1;
      if (hall.status === 'Available') acc[hall.building].available += 1;
      return acc;
    }, {}));

    res.json({ success: true, data: { total, available, occupied, byBuilding } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const hall = await Hall.findById(req.params.id).lean();
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    const [data] = await markCurrentOccupancy([hall]);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const hallId = Number(req.body.hall_id);
    if (!Number.isFinite(hallId) || hallId <= 0)
      return res.status(400).json({ success: false, message: 'Hall ID must be greater than 0' });

    const capacity = Number(req.body.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0)
      return res.status(400).json({ success: false, message: 'Capacity must be greater than 0' });

    const exists = await Hall.findOne({ hall_id: hallId });
    if (exists) return res.status(400).json({ success: false, message: `Hall ID ${req.body.hall_id} already exists` });

    const newHall = new Hall({ ...req.body, hall_id: hallId, capacity });
    await newHall.save();
    res.status(201).json({ success: true, data: newHall, message: 'Lecture Hall added successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    if (req.body.hall_id !== undefined) {
      const hallId = Number(req.body.hall_id);
      if (!Number.isFinite(hallId) || hallId <= 0)
        return res.status(400).json({ success: false, message: 'Hall ID must be greater than 0' });
      req.body.hall_id = hallId;
    }

    if (req.body.capacity !== undefined) {
      const capacity = Number(req.body.capacity);
      if (!Number.isFinite(capacity) || capacity <= 0)
        return res.status(400).json({ success: false, message: 'Capacity must be greater than 0' });
      req.body.capacity = capacity;
    }

    const hall = await Hall.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, data: hall, message: 'Hall updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (requireAdmin(req, res)) return;

    const hall = await Hall.findByIdAndDelete(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    const hallId = String(hall._id);
    await Booking.deleteMany({ hallId });
    await BookingSlot.deleteMany({ hallId });
    res.json({ success: true, message: 'Hall deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
