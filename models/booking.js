const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider"
  },

  serviceType: String,
  city: String,

  date: String,
  time: String,

  status: {
    type: String,
    enum: ["Pending", "Accepted", "Rejected", "Completed"],
    default: "Pending"
  }
});

// ✅ CREATE & EXPORT MODEL (THIS WAS MISSING)
const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
