// PZEM-004T bench tool (PlatformIO env: pzem_tool).
//
// Connect ONE meter at a time (TTL: 5V/3V3, GND, TX->GPIO16, RX->GPIO17)
// and power its AC voltage terminals. The tool talks to the meter on
// the general address 0xF8, which any single meter answers whatever
// its own address is, and every 2 s prints:
//
//     addr=0x01  V=231.4  A=0.072  W=9.3  PF=0.56  Hz=50.0  kWh=0.002
//
// Serial commands (type, then Enter; monitor at 115200):
//     1  set address 0x01  (lights circuit)
//     2  set address 0x02  (fans circuit)
//     3  set address 0x03  (main supply)
//     r  reset the energy counter
//     h  help
//
// Flash:  pio run -e pzem_tool -t upload   then   pio device monitor
// Then flash env:hw again for normal operation.

#include <Arduino.h>
#include <PZEM004Tv30.h>

#define PIN_PZEM_RX 16
#define PIN_PZEM_TX 17
#define PRINT_EVERY_MS 2000

PZEM004Tv30 pzem(Serial2, PIN_PZEM_RX, PIN_PZEM_TX);   // 0xF8: any single meter

unsigned long lastPrintMs = 0;
int failures = 0;

void printHelp() {
  Serial.println();
  Serial.println("PZEM-004T bench tool - ONE meter on the bus at a time");
  Serial.println("  1 / 2 / 3 : set address 0x01 lights / 0x02 fans / 0x03 main");
  Serial.println("  r         : reset energy counter");
  Serial.println("  h         : this help");
  Serial.println();
}

void setAddress(uint8_t address) {
  Serial.printf("Setting address 0x%02X ... ", address);

  if (pzem.setAddress(address)) {
    Serial.printf("done. Device now answers at 0x%02X.\n", pzem.readAddress(true));
  } else {
    Serial.println("FAILED (is the meter's AC side powered and TX/RX crossed?)");
  }
}

void handleCommand(char command) {
  switch (command) {
    case '1': setAddress(0x01); break;
    case '2': setAddress(0x02); break;
    case '3': setAddress(0x03); break;

    case 'r':
    case 'R':
      Serial.println(pzem.resetEnergy() ? "Energy counter reset." : "Reset FAILED.");
      break;

    case 'h':
    case 'H':
    case '?':
      printHelp();
      break;

    default:
      break;
  }
}

void printReading() {
  float voltage = pzem.voltage();

  if (isnan(voltage)) {
    failures++;
    Serial.printf("[%d] no answer from the meter. Check: AC voltage terminals powered? "
                  "PZEM TX->GPIO16, RX->GPIO17? GND shared? only ONE meter connected?\n",
                  failures);
    return;
  }

  failures = 0;

  Serial.printf("addr=0x%02X  V=%.1f  A=%.3f  W=%.1f  PF=%.2f  Hz=%.1f  kWh=%.3f\n",
                pzem.readAddress(true),
                voltage,
                pzem.current(),
                pzem.power(),
                pzem.pf(),
                pzem.frequency(),
                pzem.energy());
}

void setup() {
  Serial.begin(115200);
  delay(300);
  printHelp();
}

void loop() {
  while (Serial.available()) {
    handleCommand((char)Serial.read());
  }

  if (millis() - lastPrintMs >= PRINT_EVERY_MS) {
    lastPrintMs = millis();
    printReading();
  }
}
