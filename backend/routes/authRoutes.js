const express = require('express');
const router  = express.Router();
const Professor = require('../models/Professor');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password required' });

    const prof = await Professor.findOne({ username: username.trim(), password: password.trim() });
    if (!prof)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = Buffer.from(`${prof._id}:${Date.now()}`).toString('base64');
    res.json({
      success: true,
      token,
      user: { _id: prof._id, name: prof.name, username: prof.username, department: prof.department, role: prof.role },
      message: `Welcome, ${prof.name}!`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/professors', async (req, res) => {
  try {
    const profs = await Professor.find({}, '-password');
    res.json({ success: true, data: profs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
