// ============================================================================
// IMPORTS & DEPENDENCIES
// ============================================================================
const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');

// ============================================================================
// EXPRESS SERVER SETUP
// ============================================================================
const app = express();
const PORT = 3000;

// ============================================================================
// SERIAL PORT CONFIGURATION
// ============================================================================
// CHANGE THIS TO YOUR ARDUINO PORT
const SERIAL_PORT = 'COM8';   // Windows example
// const SERIAL_PORT = '/dev/ttyACM0'; // Linux
// const SERIAL_PORT = '/dev/cu.usbmodem****'; // macOS
const BAUD_RATE = 115200;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================
app.use(cors());
app.use(express.json());

// ============================================================================
// STATE VARIABLES
// ============================================================================
// Reference to the open serial port connection
let port;
// Most recent flex sensor reading (0.0 - 1.0), used for polling requests
let latestFlex = 0.0;

// ============================================================================
// SERIAL PORT INITIALIZATION
// ============================================================================
// Attempts to open serial connection to Arduino and set up data handlers
try {
  port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
  port.on('open', () => console.log(`Serial port ${SERIAL_PORT} opened`));
  
  // Handles incoming data from Arduino and parses flex sensor values
  port.on('data', (data) => {
    const str = data.toString();
    console.log('Arduino:', str.trim());
    
    const flexMatch = str.match(/FLEX:([0-9.]+)/);
    if (flexMatch) {
      latestFlex = parseFloat(flexMatch[1]);
      latestFlex = Math.min(1.0, Math.max(0.0, latestFlex));
      console.log(`Flex updated: ${latestFlex}`);
    }
  });
  
  // Handles serial connection errors
  port.on('error', (err) => console.error('Serial error:', err.message));
} catch (err) {
  console.error('Failed to open serial port:', err.message);
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// GET /status - Returns server and serial port connection status
app.get('/status', (req, res) => {
  res.json({ ok: true, port: SERIAL_PORT, serialOpen: port?.isOpen || false });
});

// GET /flex - Returns the latest flex sensor reading
app.get('/flex', (req, res) => {
  console.log(`GET /flex returning ${latestFlex}`);
  res.json({ flex: latestFlex });
});

// POST /hand - Receives finger angle commands and sends them to Arduino via serial
// Expected body: { thumb, index, middle, ring, pinky } (0-180 degrees each)
app.post('/hand', (req, res) => {
  const { thumb = 0, index = 0, middle = 0, ring = 0, pinky = 0 } = req.body;
  const line = `T:${thumb},I:${index},M:${middle},R:${ring},P:${pinky}\n`;
  console.log(`Sending to Arduino: ${line.trim()}`);
  if (!port || !port.isOpen) return res.status(500).json({ ok: false, error: 'Serial port closed' });
  port.write(line, (err) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, sent: line.trim() });
  });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
