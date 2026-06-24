// Auth-gated routes for the logged-in delegate's own data.
// The delegate's profile row lives in Supabase; hotel reference details are
// merged from data/hotels.json by hotel_id.
const fs = require('fs');
const path = require('path');
const express = require('express');
const { requireAuth, serviceClient } = require('../lib/supabase');

const router = express.Router();
const HOTELS_PATH = path.join(__dirname, '..', 'data', 'hotels.json');

function loadHotels() {
  try {
    return JSON.parse(fs.readFileSync(HOTELS_PATH, 'utf8')).hotels || {};
  } catch (e) {
    return {};
  }
}

async function getDelegate(userId) {
  if (!serviceClient) return null;
  const { data, error } = await serviceClient
    .from('delegates')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// Combined hotel view: the delegate's booking row + the shared hotel reference.
router.get('/hotel', requireAuth, async (req, res) => {
  const delegate = await getDelegate(req.user.id);
  if (!delegate) {
    return res.status(404).json({ error: 'No delegate profile found' });
  }
  const hotels = loadHotels();
  const hotel = (delegate.hotel_id && hotels[delegate.hotel_id]) || null;
  res.json({
    delegate: {
      name: delegate.name,
      frankfurt_id: delegate.frankfurt_id,
      room: delegate.room,
      booking_ref: delegate.booking_ref,
      check_in: delegate.check_in,
      check_out: delegate.check_out,
      meals: delegate.meals,
    },
    hotel,
  });
});

// Lightweight profile for the dashboard greeting.
router.get('/profile', requireAuth, async (req, res) => {
  const delegate = await getDelegate(req.user.id);
  res.json({
    name: (delegate && delegate.name) || req.user.email,
    email: req.user.email,
    frankfurt_id: delegate ? delegate.frankfurt_id : null,
  });
});

module.exports = router;
