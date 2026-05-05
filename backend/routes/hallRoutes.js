const express = require('express');
const router = express.Router();
const Hall = require('../models/Hall');

router.get('/', async (req, res) => {
  try {
    const { building, status, capacity, facility, search } = req.query;
    let query = {};
    if (building) query.building = building;
    if (status) query.status = status;
    if (capacity) query.capacity = { $gte: Number(capacity) };
    if (facility) query.facilities = facility;
    if (search) {
      const q = new RegExp(search, 'i');
      query.$or = [{ name: q }, { building: q }, { description: q }];
    }

    const data = await Hall.find(query).sort({ hall_id: 1 });
    res.json({ success: true, data, total: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/meta/stats', async (req, res) => {
  try {
    const total = await Hall.countDocuments();
    const available = await Hall.countDocuments({ status: 'Available' });
    const occupied = await Hall.countDocuments({ status: 'Occupied' });

    const agg = await Hall.aggregate([
      {
        $group: {
          _id: "$building",
          count: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ["$status", "Available"] }, 1, 0] } }
        }
      }
    ]);
    res.json({ success: true, data: { total, available, occupied, byBuilding: agg } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const hall = await Hall.findById(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, data: hall });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const exists = await Hall.findOne({ hall_id: Number(req.body.hall_id) });
    if (exists) return res.status(400).json({ success: false, message: `Hall ID ${req.body.hall_id} already exists` });

    const newHall = new Hall({ ...req.body, hall_id: Number(req.body.hall_id) });
    await newHall.save();
    res.status(201).json({ success: true, data: newHall, message: 'Lecture Hall added successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const hall = await Hall.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, data: hall, message: 'Hall updated successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const hall = await Hall.findByIdAndDelete(req.params.id);
    if (!hall) return res.status(404).json({ success: false, message: 'Hall not found' });
    res.json({ success: true, message: 'Hall deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;