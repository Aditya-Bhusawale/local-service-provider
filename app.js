const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");
const Booking = require("./models/booking");

const User = require("./models/user");
const ServiceProvider = require("./models/serviceprovider");

const connectDB = require("./init/index");
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
   ROUTES
======================= */

// Home
app.get("/home", (req, res) => {
  res.render("index");
});

/* ---------- USER SIGNUP ---------- */
app.get("/user-signup", (req, res) => {
  res.render("user-signup");
});

app.post("/user-signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.send("User already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      phone,
      password: hashedPassword
    });

    res.send("User registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* ---------- SERVICE PROVIDER SIGNUP ---------- */
app.get("/serviceprovider-signup", (req, res) => {
  res.render("sp-signup");
});

app.post("/serviceprovider-signup", async (req, res) => {
  try {
    const { name, email, phone, serviceType, password } = req.body;

    const existingProvider = await ServiceProvider.findOne({ email });
    if (existingProvider) return res.send("Service Provider already exists");

    const hashedPassword = await bcrypt.hash(password, 10);

    await ServiceProvider.create({
      name,
      email,
      phone,
      serviceType,
      password: hashedPassword
    });

    res.send("Service provider registered successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

/* ---------- LOGIN ---------- */
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log("LOGIN BODY:", req.body);

    let account;

    if (role === "user") {
      account = await User.findOne({ email });
    } 
    else if (role === "serviceprovider") {
      account = await ServiceProvider.findOne({ email });
    } 
    else {
      return res.send("Invalid role");
    }

    if (!account) return res.send("Email not registered");

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) return res.send("Wrong password");

    /* SAVE SESSION */
    if (role === "serviceprovider") {
      req.session.providerId = account._id;
      console.log("SESSION AFTER LOGIN:", req.session);

      return account.isProfileComplete
        ? res.redirect("/provider-dashboard")
        : res.redirect("/provider-setup");
    }

    if (role === "user") {
      req.session.userId = account._id;
      return res.redirect("/services");
    }

  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).send("Server Error");
  }
});

/* ---------- PROVIDER SETUP ---------- */
app.get("/provider-setup", (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");
  res.render("provider-setup");
});

app.post("/provider-setup", async (req, res) => {
  try {
    console.log("SESSION:", req.session);
    console.log("BODY:", req.body);

    const providerId = req.session.providerId;
    if (!providerId) return res.status(401).send("Not logged in");

    await ServiceProvider.findByIdAndUpdate(providerId, {
      experience: req.body.experience,
      pricePerVisit: req.body.pricePerVisit,
      city: req.body.city,
      pincode: req.body.pincode,
      about: req.body.about,
      isProfileComplete: true
    });

    res.redirect("/provider/dashboard");
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).send("Error updating provider profile");
  }
});

/* ---------- DASHBOARD ---------- */
app.get("/provider/dashboard", (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");
  res.send("Provider Dashboard (working)");
});

/* ---------- USER PAGES ---------- */
app.get("/services", (req, res) => {
  res.render("services");
});

app.get("/service-detail", (req, res) => {
  res.render("service-detail");
});

/* ---------- LOGOUT ---------- */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

app.get("/providers", async (req, res) => {
  try {
    const { service } = req.query;

    let filter = {
      isProfileComplete: true,
      isAvailable: true
    };

    // 🔥 FILTER BY SERVICE TYPE
    if (service) {
      filter.serviceType = new RegExp(`^${service}$`, "i");
    }

    const providers = await ServiceProvider.find(filter);

    res.render("provider-selection", { providers });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading providers");
  }
});


app.get("/provider-dashboard", async (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");

  const provider = await ServiceProvider.findById(req.session.providerId);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const bookings = await Booking.find({
    providerId: provider._id,
    status: "Pending"
  }).populate("userId");

  const todayJobs = await Booking.find({
    providerId: provider._id,
    status: "Accepted",
    date: { $gte: start, $lte: end }
  }).populate("userId");

  res.render("provider-dashboard", {
    provider,
    bookings,
    todayJobs,
    jobsTodayCount: todayJobs.length
  });
});

app.post("/booking/:id/accept", async (req, res) => {
  await Booking.findByIdAndUpdate(req.params.id, {
    status: "Accepted"
  });

  res.redirect("/provider-dashboard");
});



app.post("/booking/:id/reject", async (req, res) => {
  await Booking.findByIdAndUpdate(req.params.id, {
    status: "Rejected"
  });
  res.redirect("/provider-dashboard");
});


app.post("/provider/toggle-availability", async (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");

  const provider = await ServiceProvider.findById(req.session.providerId);

  provider.isAvailable = !provider.isAvailable;
  await provider.save();

  res.redirect("/provider-dashboard");
});


// app.get("/provider-selection", async (req, res) => {
//   try {
//     const providers = await ServiceProvider.find({
//       isProfileComplete: true,
//       isAvailable: true
//     });

//     res.render("provider-selection", { providers });

//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Error loading providers");
//   }
// });


app.get("/book/:id", async (req, res) => {
  try {
    const providerId = req.params.id;

    const provider = await ServiceProvider.findById(providerId);

    if (!provider) {
      return res.send("Provider not found");
    }

    res.render("book-provider", { provider });

  } catch (err) {
    console.error(err);
    res.send("Error loading booking page");
  }
});


app.get("/booking/:id", async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate("providerId")
      .populate("userId");

    if (!booking) {
      return res.send("Booking not found");
    }

    res.render("booking-status", { booking });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading booking status");
  }
});


app.post("/confirm-booking", async (req, res) => {
  const { providerId, date, time } = req.body;

  const provider = await ServiceProvider.findById(providerId);

  const booking = await Booking.create({
    userId: req.session.userId,
    providerId,
    serviceType: provider.serviceType,
    city: provider.city,
    date: new Date(date),   // ✅ STORE AS DATE
    time,
    status: "Pending"
  });

  res.redirect(`/booking/${booking._id}`);
});

app.get("/user-profile", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const user = await User.findById(req.session.userId);

  if (!user) return res.send("User not found");

  res.render("user-profile", { user });
});

app.get("/provider-profile", async (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");

  const provider = await ServiceProvider.findById(req.session.providerId);

  if (!provider) return res.send("Provider not found");

  res.render("provider-profile", { provider });
});

app.get("/provider/profile/edit", async (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");

  const provider = await ServiceProvider.findById(req.session.providerId);
  res.render("provider-edit", { provider });
});

app.post("/provider/profile/edit", async (req, res) => {
  if (!req.session.providerId) return res.redirect("/login");

  await ServiceProvider.findByIdAndUpdate(req.session.providerId, {
    name: req.body.name,
    phone: req.body.phone,
    city: req.body.city,
    experience: req.body.experience,
    pricePerVisit: req.body.pricePerVisit,
    about: req.body.about,
    isAvailable: req.body.isAvailable === "true"
  });

  res.redirect("/provider-profile");
});

app.get("/provider-booking-history", async (req, res) => {
  try {
    if (!req.session.providerId) {
      return res.redirect("/login");
    }

    const bookings = await Booking.find({
      providerId: req.session.providerId
    })
    .populate("userId")          // 👈 THIS SENDS USER DATA
    .sort({ createdAt: -1 });

    res.render("provider-booking-history", { bookings });

  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});



/* =======================
   SERVER
======================= */
app.listen(8080, () => {
  console.log("Server running at http://localhost:8080/home");
});
