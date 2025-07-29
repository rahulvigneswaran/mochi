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

const API_URL = "https://script.google.com/macros/s/AKfycbzJEZbrUyFF3cwM_z41BqG26OWFH6jwEhTBLwHTW83_J7oe1Jk1mXu47s4wfDYL4QEm/exec"; // Google Script URL

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
      let lastSeen;
      
      // If it's already a Date object
      if (timestamp instanceof Date) {
        lastSeen = timestamp;
      } else {
        // Handle DD/MM/YYYY, HH:MM:SS format from Google Apps Script
        const timestampStr = timestamp.toString().trim();
        
        // Check if it's in DD/MM/YYYY format (like "29/07/2025, 18:27:27")
        const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}):(\d{2}):(\d{2})$/;
        const match = timestampStr.match(ddmmyyyyPattern);
        
        if (match) {
          // Convert DD/MM/YYYY to MM/DD/YYYY for JavaScript Date
          const [, day, month, year, hour, minute, second] = match;
          const reformattedTimestamp = `${month}/${day}/${year}, ${hour}:${minute}:${second}`;
          console.log("Converting timestamp from:", timestampStr, "to:", reformattedTimestamp);
          lastSeen = new Date(reformattedTimestamp);
        } else {
          // Try parsing as-is for other formats
          lastSeen = new Date(timestampStr);
          
          // If parsing failed, try removing commas
          if (isNaN(lastSeen.getTime())) {
            const cleanTimestamp = timestampStr.replace(/,/g, '').trim();
            lastSeen = new Date(cleanTimestamp);
          }
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
      // We'll use a dummy state update to trigger re-render
      if (timestamp) {
        console.log("Updating time display, current timestamp:", timestamp);
        console.log("Time ago result:", getHoursAgo(timestamp));
        // Force re-render by updating a dummy state
        setLoading(prev => prev);
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timestamp]); // Add timestamp as dependency

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
      
      try {
        console.log("Sending location data:", { lat: latitude, lng: longitude, time: now });
        
        // Use GET request with query parameters
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
        console.log("Response ok:", response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Response error:", errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.text();
        console.log("Response body:", result);
        
        // Check if the response indicates success
        let responseData;
        try {
          responseData = JSON.parse(result);
          console.log("Parsed response:", responseData);
        } catch (e) {
          console.log("Response is not JSON, treating as text:", result);
          responseData = { text: result };
        }
        
        // Only update local state if server confirms success
        if (responseData.success || result.includes('success') || result === 'OK') {
          setLocation([latitude, longitude]);
          setTimestamp(now);
          showNotification("🎉 Thanks! Mochi's location has been updated successfully!", 'success');
          
          // Refresh the location from server to confirm it was saved
          setTimeout(() => {
            fetchLocation();
          }, 1000);
        } else {
          throw new Error(`Server did not confirm update: ${result}`);
        }
        
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
      <div className="flex-1 flex flex-col items-center p-4 gap-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img 
              src="/mochi.jpg" 
              alt="Mochi the dog" 
              className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 border-green-200 shadow-lg"
            />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800">Mochi Tracker</h1>
          </div>
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
                    <div className="text-center">
                      <img 
                        src="/mochi.jpg" 
                        alt="Mochi" 
                        className="w-12 h-12 rounded-full object-cover mx-auto mb-2 border-2 border-green-300"
                      />
                      <div>
                        <strong>Mochi was spotted here!</strong><br />
                        <em>{timestamp}</em>
                        {(() => {
                          const timeAgo = getHoursAgo(timestamp);
                          return timeAgo ? (
                            <>
                              <br />
                              <small>🕒 {timeAgo}</small>
                            </>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="mt-4 text-center bg-white rounded-lg p-4 shadow-md">
              <p className="text-gray-700 text-lg md:text-xl font-medium mb-1">Last seen:</p>
              <p className="text-gray-900 text-xl md:text-2xl font-bold mb-2">{timestamp}</p>
              {(() => {
                const timeAgo = getHoursAgo(timestamp);
                console.log("Rendering time ago:", timeAgo, "for timestamp:", timestamp);
                return timeAgo ? (
                  <p className="text-green-600 text-lg md:text-xl font-semibold">
                    🕒 {timeAgo}
                  </p>
                ) : (
                  <p className="text-gray-500 text-sm">Time calculation unavailable</p>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="text-center bg-white rounded-lg p-6 shadow-md">
            <p className="text-gray-600 text-lg">No Mochi sightings reported yet 🔍</p>
            <p className="text-gray-500 text-sm mt-2">Be the first to spot our furry friend!</p>
          </div>
        )}
      </div>
      
      {/* Fixed bottom section with notification and button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg">
        {/* Custom Notification - positioned above button */}
        {notification && (
          <div className={`p-4 border-b transition-all duration-300 ${
            notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center gap-3 max-w-md mx-auto">
              <div className="text-xl">
                {notification.type === 'success' ? '✅' : 
                 notification.type === 'error' ? '❌' : 
                 '📍'}
              </div>
              <p className="font-medium flex-1 text-sm">{notification.message}</p>
              <button 
                onClick={() => setNotification(null)}
                className="text-xl hover:opacity-70 transition-opacity"
              >
                ×
              </button>
            </div>
          </div>
        )}
        
        {/* Button */}
        <div className="p-4">
          <button
            onClick={shareLocation}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white px-8 py-4 rounded-2xl shadow-lg text-xl font-bold transition-colors duration-200 w-full max-w-md mx-auto block"
          >
            🐕 I see Mochi!
          </button>
        </div>
      </div>
    </div>
  );
}
