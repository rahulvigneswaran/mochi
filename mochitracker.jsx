import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const API_URL = "https://script.google.com/a/macros/iith.ac.in/s/AKfycby-8Gq9Lq24Zl1Avhm5wGuCm3h9p7YbICqmA4S6evGsIxjm1wgPQlop6Vlc4pMVpfAl/exec"; // Google Script URL

export default function App() {
  const [location, setLocation] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch latest Mochi location
  const fetchLocation = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data?.lat && data?.lng) {
        setLocation([parseFloat(data.lat), parseFloat(data.lng)]);
        setTimestamp(data.time);
      }
    } catch (e) {
      console.error("Error fetching location", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // Share current location
  const shareLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const now = new Date().toLocaleString();
      setLocation([latitude, longitude]);
      setTimestamp(now);
      try {
        await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: latitude, lng: longitude, time: now })
        });
        alert("Mochi's location updated!");
      } catch (e) {
        alert("Failed to update location.");
      }
    });
  };

  return (
    <div className="flex flex-col items-center p-4 gap-4">
      <h1 className="text-2xl font-bold">Mochi Tracker 🐶</h1>
      <button
        onClick={shareLocation}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow"
      >
        Share Mochi's Location
      </button>

      {loading ? (
        <p>Loading last seen location...</p>
      ) : location ? (
        <>
          <div className="w-full h-[400px] md:w-[600px]">
            <MapContainer
              center={location}
              zoom={17}
              scrollWheelZoom={true}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <Marker position={location}>
                <Popup>
                  Mochi was last seen here<br />
                  <strong>{timestamp}</strong>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
          <p className="text-gray-600 text-sm">Last updated: {timestamp}</p>
        </>
      ) : (
        <p>No sightings reported yet.</p>
      )}
    </div>
  );
}
