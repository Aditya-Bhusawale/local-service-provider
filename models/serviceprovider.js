const mongoose = require("mongoose");

const serviceProviderSchema = new mongoose.Schema({
  // BASIC INFO (saved during signup/login)
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  phone: {
    type: Number,
    required: true,
    unique: true
  },

  serviceType: {
    type: String, // plumber, electrician, etc.
    required: true
  },

  password: {
    type: String,
    required: true
  },

  // EXTRA INFO (filled after login)
  experience: {
    type: Number
  },

  pricePerVisit: {
    type: Number
  },

  city: {
    type: String
  },

  pincode: {
    type: Number
  },

  about: {
    type: String
  },

  // STATUS & FLAGS
  isProfileComplete: {
    type: Boolean,
    default: false
  },

  isAvailable: {
    type: Boolean,
    default: true
  },

  rating: {
    type: Number,
    default: 0
  },

  totalJobs: {
    type: Number,
    default: 0
  },

  // TIMESTAMPS
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
