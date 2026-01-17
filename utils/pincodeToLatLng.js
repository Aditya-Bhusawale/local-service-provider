const axios = require("axios");

async function pincodeToLatLng(pincode) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&country=india&postalcode=${pincode}`;

  const res = await axios.get(url, {
    headers: { "User-Agent": "servicehub" }
  });

  if (!res.data.length) throw new Error("Invalid pincode");

  return {
    lat: parseFloat(res.data[0].lat),
    lng: parseFloat(res.data[0].lon)
  };
}

module.exports = pincodeToLatLng;
