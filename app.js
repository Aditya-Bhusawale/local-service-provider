const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

const connectDB = require("./init/index");
const Booking = require("./models/booking");
const User = require("./models/user");
const ServiceProvider = require("./models/serviceprovider");

connectDB();

const app = express();

/* =======================
   MIDDLEWARE
======================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "servicehub_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   HOME
======================= */
app.get("/home", (req, res) => {
  res.render("index");
});

/* =======================
   USER SIGNUP
======================= */
app.get("/user-signup", (req, res) => {
  res.render("user-signup");
});

app.post("/user-signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.send("User already exists");

    const hashed = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      phone,
      password: hashed
    });

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* =======================
   PROVIDER SIGNUP
======================= */
app.get("/serviceprovider-signup", (req, res) => {
  res.render("sp-signup");
});

app.post("/serviceprovider-signup", async (req, res) => {
  try {
    const { name, email, phone, serviceType, password } = req.body;

    const exists = await ServiceProvider.findOne({ email });
    if (exists) return res.send("Provider already exists");

    const hashed = await bcrypt.hash(password, 10);

    await ServiceProvider.create({
      name,
      email,
      phone,
      serviceType,
      password: hashed,
      isProfileComplete: false,
      isAvailable: true
    });

    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* =======================
   LOGIN
======================= */
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    let account;

    if (role === "user") {
      account = await User.findOne({ email });
    } else if (role === "serviceprovider") {
      account = await ServiceProvider.findOne({ email });
    } else {
      return res.send("Invalid role");
    }

    if (!account) return res.send("Email not registered");

    const match = await bcrypt.compare(password, account.password);
    if (!match) return res.send("Wrong password");

    if (role === "user") {
      req.session.userId = account._id;
      return res.redirect("/services");
    }

    if (role === "serviceprovider") {
      req.session.providerId = account._id;
      return account.isProfileComplete
        ? res.redirect("/provider-dashboard")
        : res.redirect("/provider-setup");
    }

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* =======================
   PROVIDER SETUP
======================= */
app.get("/provider-setup", (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");
  res.render("provider-setup");
});

app.post("/provider-setup", async (req, res) => {
  try {
    await ServiceProvider.findByIdAndUpdate(req.session.providerId, {
      experience: req.body.experience,
      pricePerVisit: req.body.pricePerVisit,
      city: req.body.city,
      pincode: req.body.pincode,
      address: req.body.address,   
      about: req.body.about,
      isProfileComplete: true
    });

    res.redirect("/provider-dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating profile");
  }
});


/* =======================
   PROVIDER DASHBOARD (REAL DATA)
======================= */
app.get("/provider-dashboard", async (req, res) => {
  try {
    if (!req.session.providerId) {
      return res.redirect("/login");
    }

    const providerId = req.session.providerId;
    const now = new Date();

    // ================= DATE CALCULATIONS =================
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) + 1);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ================= FETCH ALL COMPLETED / ACCEPTED BOOKINGS =================
    const allBookings = await Booking.find({
      providerId,
      status: { $in: ["Accepted", "Completed"] }
    });

    let todayEarnings = 0;
    let weekEarnings = 0;
    let monthEarnings = 0;
    let jobsTodayCount = 0;

    allBookings.forEach(b => {
      const bookingDate = new Date(b.date);

      if (bookingDate >= startOfToday) {
        todayEarnings += b.price || 0;
        jobsTodayCount++;
      }

      if (bookingDate >= startOfWeek) {
        weekEarnings += b.price || 0;
      }

      if (bookingDate >= startOfMonth) {
        monthEarnings += b.price || 0;
      }
    });

    // ================= PENDING BOOKINGS =================
    const bookings = await Booking.find({
      providerId,
      status: "Pending"
    }).populate("userId", "name phone");

    // ================= TODAY JOBS =================
    const todayJobs = await Booking.find({
      providerId,
      status: { $in: ["Accepted", "Completed"] },
      date: { $gte: startOfToday }
    }).populate("userId", "name phone");

    // ================= PROVIDER INFO =================
    const provider = await ServiceProvider.findById(providerId);
    if (!provider) {
      return res.redirect("/login");
    }

    // Attach stats (not saved in DB)
    provider.todayEarnings = todayEarnings;
    provider.weekEarnings = weekEarnings;
    provider.monthEarnings = monthEarnings;

    // ================= RENDER =================
    res.render("provider-dashboard", {
      provider,
      bookings,
      todayJobs,
      jobsTodayCount
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* =======================
   SERVICES & PROVIDERS
======================= */
app.get("/services", (req, res) => {
  res.render("services");
});

app.get("/providers", async (req, res) => {
  const filter = {
    isProfileComplete: true,
    isAvailable: true
  };

  const { service, city, pincode, experience, price } = req.query;

  if (service) filter.serviceType = new RegExp(`^${service}$`, "i");
  if (city) filter.city = new RegExp(city, "i");
  if (pincode) filter.pincode = pincode;
  if (experience) filter.experience = { $gte: Number(experience) };
  if (price) filter.pricePerVisit = { $lte: Number(price) };

  const providers = await ServiceProvider.find(filter);

  res.render("provider-selection", { providers, filters: req.query });
});

/* =======================
   BOOKING
======================= */
app.get("/book/:id", async (req, res) => {
  const provider = await ServiceProvider.findById(req.params.id);
  if (!provider) return res.send("Provider not found");
  res.render("book-provider", { provider });
});

app.post("/confirm-booking", async (req, res) => {
  const {
    providerId,
    date,
    time,
    address,
    pincode
  } = req.body;

  const booking = await Booking.create({
    providerId: providerId,
    userId: req.session.userId,
    date,
    time,
    address,
    pincode,
    status: "Pending"
  });

  res.redirect(`/booking/${booking._id}`);
});


app.get("/booking/:id", async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("providerId")
    .populate("userId");

  res.render("booking-status", { booking });
});

/* =======================
   BOOKING ACTIONS
======================= */
app.post("/booking/:id/accept", async (req, res) => {
  await Booking.findByIdAndUpdate(req.params.id, { status: "Accepted" });
  res.redirect("/provider-dashboard");
});

app.post("/booking/:id/reject", async (req, res) => {
  await Booking.findByIdAndUpdate(req.params.id, { status: "Rejected" });
  res.redirect("/provider-dashboard");
});

/* =======================
   USER & PROVIDER PAGES
======================= */
app.get("/user-profile", async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render("user-profile", { user });
});

app.get("/provider-profile", async (req, res) => {
  const provider = await ServiceProvider.findById(req.session.providerId);
  res.render("provider-profile", { provider });
});

app.get("/provider-booking-history", async (req, res) => {
  const bookings = await Booking.find({ providerId: req.session.providerId })
    .populate("userId")
    .sort({ createdAt: -1 });

  res.render("provider-booking-history", { bookings });
});

app.get("/my-bookings", async (req, res) => {
  const bookings = await Booking.find({ userId: req.session.userId })
    .populate("providerId", "name serviceType")
    .sort({ createdAt: -1 });

  res.render("user-transaction", { bookings });
});

app.get("/provider/profile/edit", async (req, res) => {
  const provider = await ServiceProvider.findById(req.session.providerId);
  if (!provider) {
    return res.redirect("/login");
  }
  res.render("provider-edit", { provider });
});

app.post("/provider/profile/edit", async (req, res) => {
  await ServiceProvider.findByIdAndUpdate(
    req.session.providerId,
    {
      name: req.body.name,
      phone: req.body.phone,
      city: req.body.city,
      experience: req.body.experience,
      pricePerVisit: req.body.pricePerVisit,
      about: req.body.about,
      isAvailable: req.body.isAvailable === "true"
    }
  );

  res.redirect("/provider-profile");
});


<<<<<<< HEAD
=======
    const bookings = await Booking.find({
      providerId: req.session.providerId
    })
    .populate("userId")          
    .sort({ createdAt: -1 });
>>>>>>> eb1262dadfa89943c3fd7b3bbb61e8fbbe21f21d

/* =======================
   LOGOUT
======================= */
app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

/* =======================
   SERVER
======================= */
app.listen(8080, () => {
  console.log("Server running at http://localhost:8080/home");
});
