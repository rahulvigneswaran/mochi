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

const API_URL = "https://script.google.com/macros/s/AKfycby-8Gq9Lq24Zl1Avhm5wGuCm3h9p7YbICqmA4S6evGsIxjm1wgPQlop6Vlc4pMVpfAl/exec"; // Google Script URL

export default function App() {
  const [location, setLocation] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // PWA Install functionality
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  };

  const isInStandaloneMode = () => {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  };

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
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex-1 flex flex-col items-center p-4 gap-6">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">Mochi Tracker 🐶</h1>
          <p className="text-gray-600 text-sm md:text-base">Keep track of our furry friend</p>
        </div>
        
        {/* Install buttons - only show if not already installed */}
        {!isInStandaloneMode() && (
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            {/* Android/Chrome install button */}
            {showInstallPrompt && (
              <button
                onClick={handleInstallClick}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-md text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
              >
                🐶 Install App
              </button>
            )}
            
            {/* iOS install instructions */}
            {isIOS() && (
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-center">
                <p className="text-blue-800 text-xs font-medium mb-1">📱 Install on iOS:</p>
                <p className="text-blue-700 text-xs">Tap Share → Add to Home Screen</p>
              </div>
            )}
          </div>
        )}

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
      
      {/* Fixed bottom button for mobile accessibility */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <button
          onClick={shareLocation}
          className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-8 py-4 rounded-2xl shadow-lg text-xl font-bold transition-colors duration-200 w-full max-w-md mx-auto block"
        >
          🐕 I see Mochi!
        </button>
      </div>
    </div>
  );
}
