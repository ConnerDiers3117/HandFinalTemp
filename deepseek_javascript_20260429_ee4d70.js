const express = require('express');
const cors = require('cors');
const { SerialPort } = require('serialport');

const app = express();
const PORT = 3000;

// 👇 CHANGE THIS TO YOUR ARDUINO PORT
const SERIAL_PORT = 'COM8';   // Windows example
// const SERIAL_PORT = '/dev/ttyACM0'; // Linux
// const SERIAL_PORT = '/dev/cu.usbmodem****'; // macOS
const BAUD_RATE = 115200;

app.use(cors());
app.use(express.json());

let port;
try {
  port = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
  port.on('open', () => console.log(`✅ Serial port ${SERIAL_PORT} opened`));
  port.on('data', (data) => console.log('📟 Arduino:', data.toString()));
  port.on('error', (err) => console.error('Serial error:', err.message));
} catch (err) {
  console.error('Failed to open serial port:', err.message);
}

app.get('/status', (req, res) => {
  res.json({ ok: true, port: SERIAL_PORT, serialOpen: port?.isOpen || false });
});

app.post('/hand', (req, res) => {
  const { thumb = 0, index = 0, middle = 0, ring = 0, pinky = 0 } = req.body;
  const line = `T:${thumb},I:${index},M:${middle},R:${ring},P:${pinky}\n`;
  console.log('✉️ Sending:', line.trim());
  if (!port || !port.isOpen) return res.status(500).json({ ok: false, error: 'Serial port closed' });
  port.write(line, (err) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, sent: line.trim() });
  });
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
