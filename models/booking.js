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
  address: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true
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


const Booking = mongoose.model("Booking", bookingSchema);
module.exports = Booking;
