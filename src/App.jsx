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

const API_URL = "https://script.google.com/macros/s/AKfycbxLjd4mQI22b60NUdmbDsPuE7o8dXt-dzXj2V4EwEYiOl5DzfpQHqQP1iyZVtEo20pS/exec"; // Google Script URL

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
        console.log("Sending location data:", { lat: latitude, lng: longitude, time: now });
        
        // Use GET request with query parameters instead of POST
        const url = new URL(API_URL);
        url.searchParams.append('action', 'update');
        url.searchParams.append('lat', latitude.toString());
        url.searchParams.append('lng', longitude.toString());
        url.searchParams.append('time', now);
        
        console.log("Request URL:", url.toString());
        
        const response = await fetch(url.toString(), {
          method: "GET",
          mode: "cors"
        });
        
        console.log("Response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Response error:", errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.text();
        console.log("Response body:", result);
        alert("Mochi's location updated!");
      } catch (e) {
        console.error("Full error details:", e);
        alert(`Failed to update location: ${e.message}`);
      }
    }, (error) => {
      console.error("Geolocation error:", error);
      alert(`Geolocation error: ${error.message}`);
    });
  };

  return (
    <div className="flex flex-col items-center p-4 gap-6 min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Mochi Tracker 🐶</h1>
        <p className="text-gray-600 text-sm md:text-base">Keep track of our furry friend</p>
      </div>
      
      <button
        onClick={shareLocation}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl shadow-lg text-lg font-semibold transition-colors duration-200 w-full max-w-xs"
      >
        🐕 I see Mochi!
      </button>

      {loading ? (
        <div className="text-center">
          <div className="animate-pulse text-gray-600">
            <p className="text-lg">Looking for Mochi...</p>
          </div>
        </div>
      ) : location ? (
        <div className="w-full max-w-4xl">
          <div className="w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden shadow-lg">
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
                  🐶 Mochi was spotted here!<br />
                  <strong>{timestamp}</strong>
                </Popup>
              </Marker>
            </MapContainer>
          </div>
          <div className="mt-4 text-center bg-white rounded-lg p-4 shadow-md">
            <p className="text-gray-700 text-lg md:text-xl font-medium mb-1">Last seen:</p>
            <p className="text-gray-900 text-xl md:text-2xl font-bold">{timestamp}</p>
          </div>
        </div>
      ) : (
        <div className="text-center bg-white rounded-lg p-6 shadow-md">
          <p className="text-gray-600 text-lg">No Mochi sightings reported yet 🔍</p>
          <p className="text-gray-500 text-sm mt-2">Be the first to spot our furry friend!</p>
        </div>
      )}
    </div>
  );
}
