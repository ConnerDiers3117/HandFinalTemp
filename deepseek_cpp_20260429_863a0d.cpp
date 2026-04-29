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
  Serial.println("Expecting format: T:90,I:45,M:120,R:30,P:10");
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();

    if (line.length() > 0) {
      parseAndMove(line);
    }
  }
}

void parseAndMove(String data) {
  int t, i, m, r, p;

  int matched = sscanf(
    data.c_str(),
    "T:%d,I:%d,M:%d,R:%d,P:%d",
    &t, &i, &m, &r, &p
  );

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

    Serial.print("OK ");
    Serial.println(data);
  } else {
    Serial.print("BAD DATA: ");
    Serial.println(data);
  }
}