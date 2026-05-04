#include <Servo.h>

Servo thumbServo;
Servo indexServo;
Servo middleServo;
Servo ringServo;
Servo pinkyServo;

int thumbAngle = 90;
int indexAngle = 90;
int middleAngle = 90;
int ringAngle = 90;
int pinkyAngle = 90;

// Flex sensor calibration (replace with your values)
const int FLEX_PIN = A0;
const int FLEX_STRAIGHT = 156;   // raw ADC when straight (hand open)
const int FLEX_CURLED   = 326;   // raw ADC when fully curled (fist)

unsigned long lastFlexRead = 0;
const unsigned long FLEX_INTERVAL = 100; // ms

void setup() {
  Serial.begin(115200);

  thumbServo.attach(3);
  indexServo.attach(5);
  middleServo.attach(6);
  ringServo.attach(9);
  pinkyServo.attach(10);

  thumbServo.write(thumbAngle);
  indexServo.write(indexAngle);
  middleServo.write(middleAngle);
  ringServo.write(ringAngle);
  pinkyServo.write(pinkyAngle);

  Serial.println("READY");
  Serial.print("Calibration: STRAIGHT=");
  Serial.print(FLEX_STRAIGHT);
  Serial.print(" CURLED=");
  Serial.println(FLEX_CURLED);
}

void loop() {
  // Handle incoming serial commands (from Node.js)
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      parseAndMove(line);
    }
  }

  // Read flex sensor and send value to Node.js
  unsigned long now = millis();
  if (now - lastFlexRead >= FLEX_INTERVAL) {
    lastFlexRead = now;
    int raw = analogRead(FLEX_PIN);

    float closure;
    if (raw <= FLEX_STRAIGHT) {
      closure = 0.0;
    } else if (raw >= FLEX_CURLED) {
      closure = 1.0;
    } else {
      closure = (float)(raw - FLEX_STRAIGHT) / (FLEX_CURLED - FLEX_STRAIGHT);
    }
    closure = constrain(closure, 0.0, 1.0);

    Serial.print("FLEX:");
    Serial.println(closure, 3);
  }
}

void parseAndMove(String data) {
  int t, i, m, r, p;
  int matched = sscanf(data.c_str(), "T:%d,I:%d,M:%d,R:%d,P:%d", &t, &i, &m, &r, &p);
  if (matched == 5) {
    thumbAngle = constrain(t, 0, 180);
    indexAngle = constrain(i, 0, 180);
    middleAngle = constrain(m, 0, 180);
    ringAngle = constrain(r, 0, 180);
    pinkyAngle = constrain(p, 0, 180);

    thumbServo.write(thumbAngle);
    indexServo.write(indexAngle);
    middleServo.write(middleAngle);
    ringServo.write(ringAngle);
    pinkyServo.write(pinkyAngle);
  } else {
    Serial.print("BAD DATA: ");
    Serial.println(data);
  }
}
