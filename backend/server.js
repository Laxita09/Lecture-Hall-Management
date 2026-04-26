require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const connectDB = require('./db/database');
connectDB(); // Init MongoDB

const hallRoutes    = require('./routes/hallRoutes');
const authRoutes    = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/halls',    hallRoutes);
app.use('/api/auth',     authRoutes);
app.use('/api/bookings', bookingRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ status: 'OK', time: new Date(), engine: 'mongodb' })
);

app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'))
);

app.listen(PORT, () => {
  console.log(`\n🚀  Server running at http://localhost:${PORT}\n`);
});
