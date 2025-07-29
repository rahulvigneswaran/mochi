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
  const [notification, setNotification] = useState(null);

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

  // Calculate how many hours ago Mochi was seen
  const getHoursAgo = (timestamp) => {
    if (!timestamp) return null;
    
    try {
      // Handle different timestamp formats
      let lastSeen;
      
      // If it's already a Date object
      if (timestamp instanceof Date) {
        lastSeen = timestamp;
      } else {
        // Try to parse the timestamp string
        // Handle formats like "7/29/2025, 1:30:00 PM" or ISO strings
        lastSeen = new Date(timestamp);
        
        // If parsing failed, try alternative parsing
        if (isNaN(lastSeen.getTime())) {
          // Try parsing with different format assumptions
          const cleanTimestamp = timestamp.replace(/,/g, '').trim();
          lastSeen = new Date(cleanTimestamp);
        }
      }
      
      // Check if we have a valid date
      if (isNaN(lastSeen.getTime())) {
        console.error("Invalid timestamp format:", timestamp);
        return null;
      }
      
      const now = new Date();
      const diffInMs = now - lastSeen;
      
      // Handle negative differences (future dates)
      if (diffInMs < 0) {
        return "just now";
      }
      
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      
      if (diffInHours < 1) {
        if (diffInMinutes < 1) {
          return "just now";
        }
        return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
      } else {
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
      }
    } catch (error) {
      console.error("Error calculating time ago:", error, "Timestamp:", timestamp);
      return null;
    }
  };

  // Show custom notification
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000); // Hide after 4 seconds
  };

  // Fetch latest Mochi location
  const fetchLocation = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      console.log("API response data:", data); // Debug log
      if (data?.lat && data?.lng) {
        setLocation([parseFloat(data.lat), parseFloat(data.lng)]);
        console.log("Timestamp from API:", data.time, "Type:", typeof data.time); // Debug log
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

  // Update the "hours ago" display every minute
  useEffect(() => {
    const interval = setInterval(() => {
      // Force a re-render to update the "hours ago" display
      setTimestamp(prev => prev);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Share current location
  const shareLocation = async () => {
    if (!navigator.geolocation) {
      showNotification("Geolocation not supported on this device", 'error');
      return;
    }
    
    // Show loading state
    showNotification("Getting your location...", 'loading');
    
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
        showNotification("🎉 Thanks! Mochi's location has been updated successfully!", 'success');
      } catch (e) {
        console.error("Full error details:", e);
        showNotification(`Failed to update location: ${e.message}`, 'error');
      }
    }, (error) => {
      console.error("Geolocation error:", error);
      showNotification(`Location access denied. Please enable location services.`, 'error');
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Custom Notification */}
      {notification && (
        <div className={`fixed top-4 left-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 ${
          notification.type === 'success' ? 'bg-green-100 border border-green-400 text-green-800' :
          notification.type === 'error' ? 'bg-red-100 border border-red-400 text-red-800' :
          'bg-blue-100 border border-blue-400 text-blue-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="text-xl">
              {notification.type === 'success' ? '✅' : 
               notification.type === 'error' ? '❌' : 
               '📍'}
            </div>
            <p className="font-medium flex-1">{notification.message}</p>
            <button 
              onClick={() => setNotification(null)}
              className="text-xl hover:opacity-70 transition-opacity"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
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
                    {getHoursAgo(timestamp) && (
                      <>
                        <br />
                        <em>🕒 {getHoursAgo(timestamp)}</em>
                      </>
                    )}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="mt-4 text-center bg-white rounded-lg p-4 shadow-md">
              <p className="text-gray-700 text-lg md:text-xl font-medium mb-1">Last seen:</p>
              <p className="text-gray-900 text-xl md:text-2xl font-bold mb-2">{timestamp}</p>
              {getHoursAgo(timestamp) && (
                <p className="text-green-600 text-lg md:text-xl font-semibold">
                  🕒 {getHoursAgo(timestamp)}
                </p>
              )}
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
