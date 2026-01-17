const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/serviceApp");
    console.log("MongoDB connected (local)");
  } catch (err) {
    console.log("DB connection error:", err.message);
  }
};

module.exports = connectDB;
