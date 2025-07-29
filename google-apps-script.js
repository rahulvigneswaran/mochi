// Updated Google Apps Script code for Mochi Tracker
// Copy this code to your Google Apps Script project

function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const params = e.parameter;
  
  console.log("doGet called with params:", params);
  
  // Check if this is an update request (with action=update parameter)
  if (params.action === 'update') {
    try {
      // Handle location update via GET request
      const lat = params.lat;
      const lng = params.lng;
      const time = params.time;
      
      console.log("Updating location:", { lat, lng, time });
      
      // Validate parameters
      if (!lat || !lng || !time) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Missing required parameters"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // Update the sheet (row 2, columns A, B, C)
      sheet.getRange(2, 1, 1, 3).setValues([[lat, lng, time]]);
      
      console.log("Location updated successfully");
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Location updated successfully"
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (error) {
      console.error("Error updating location:", error);
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } else {
    // Handle location fetch (existing logic)
    try {
      const data = sheet.getRange(2, 1, 1, 3).getValues()[0];
      console.log("Fetching location:", data);
      
      return ContentService.createTextOutput(JSON.stringify({
        lat: data[0], 
        lng: data[1], 
        time: data[2]
      })).setMimeType(ContentService.MimeType.JSON);
      
    } catch (error) {
      console.error("Error fetching location:", error);
      return ContentService.createTextOutput(JSON.stringify({
        lat: null,
        lng: null,
        time: null,
        error: error.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
}

function doPost(e) {
  // Keep the existing doPost for backward compatibility
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const json = JSON.parse(e.postData.contents);
    sheet.getRange(2, 1, 1, 3).setValues([[json.lat, json.lng, json.time]]);
    return ContentService.createTextOutput("OK");
  } catch (error) {
    console.error("Error in doPost:", error);
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}
