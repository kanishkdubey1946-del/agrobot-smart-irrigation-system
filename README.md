# 🌱 AgroBot — Smart Soil Moisture Monitoring System

> An IoT-based real-time soil moisture detection and monitoring system built with NodeMCU V3 and a live web dashboard.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-AgroBot%20Dashboard-green?style=for-the-badge)](https://kanishkdubey1946-del-agobot-smart-i.vercel.app/login.html)
[![Platform](https://img.shields.io/badge/Platform-NodeMCU%20V3%20(ESP8266)-blue?style=for-the-badge)](https://nodemcu.readthedocs.io/)
[![IDE](https://img.shields.io/badge/IDE-Arduino-teal?style=for-the-badge)](https://www.arduino.cc/)
[![Status](https://img.shields.io/badge/Status-In%20Progress-orange?style=for-the-badge)](#current-progress)

---

## 📖 Overview

AgroBot addresses a critical problem in Indian agriculture — the lack of affordable, real-time soil moisture monitoring. Farmers across Maharashtra and Madhya Pradesh suffer preventable crop losses every year due to over-irrigation and under-irrigation, forced to rely on guesswork with no way to check soil conditions remotely.

AgroBot solves this by connecting a physical soil moisture sensor to the internet over Wi-Fi. The device reads moisture levels every 10 seconds and sends data to a web server. Anyone with access can monitor soil conditions from their phone or laptop without visiting the field.

This project was built as a **Capstone-I project** in the 2nd semester of the CSDA program at **IIT Patna**.

---

## ✨ Features

- 📡 **Real-time wireless monitoring** — moisture data sent to the server via HTTP POST over Wi-Fi every 10 seconds
- 📊 **Live web dashboard** — displays current soil moisture level and a 7-day historical chart
- 🔔 **Local buzzer alerts** — warns when soil is too dry (3 short beeps) or waterlogged (2 long beeps), even without internet
- 💡 **Single-board design** — NodeMCU V3 handles both sensor reading and Wi-Fi transmission on one compact board
- 🌐 **Login & device connection page** — connect any NodeMCU/ESP8266 device with a custom device ID and server URL

---

## 🛠️ Hardware Components

| Component | Description |
|---|---|
| **NodeMCU V3 (ESP-12E)** | Central microcontroller — ESP8266-based, 80 MHz, built-in Wi-Fi, CH340C USB chip |
| **Resistive Soil Moisture Sensor** | Two-probe sensor; outputs analog voltage to NodeMCU pin A0 |
| **Piezoelectric Buzzer** | Connected to pin D2; provides local dry/wet alerts independent of internet |
| **Physical Enclosure** | All components assembled inside a compact enclosure as one unit |

### Wiring Summary

```
Soil Moisture Sensor  →  NodeMCU A0  (analog input)
Buzzer (+)            →  NodeMCU D2  (digital output)
Power                 →  Micro USB
```

---

## ⚙️ How It Works

### Firmware Logic (NodeMCU)

1. Every **10 seconds**, the firmware reads pin A0 **five times** (with 50 ms gaps) and averages the values to filter noise.
2. The raw ADC value (0–1023) is mapped to a **moisture percentage** using `map()` and clamped with `constrain()`.
3. The raw value is compared against `DRY_THRESHOLD` and `WET_THRESHOLD` constants:
   - Below dry threshold → **3 short beeps**
   - Above wet threshold → **2 long beeps**
   - Within safe range → **buzzer off**
4. The NodeMCU connects to Wi-Fi via `WiFi.begin()` and sends the moisture reading to the server via an **HTTP POST** request using `ESP8266HTTPClient`.

### Libraries Used

```cpp
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
```

---

## 🔄 Hardware Revision (Mid-Semester → Final)

The original design used an Arduino Uno + a separate ESP8266 ESP-01 module communicating via UART AT commands. This was unreliable and complex (voltage dividers, baud rate matching, AT command failures).

| Feature | Mid-Semester Design | Final Design |
|---|---|---|
| Main board | Arduino Uno (ATmega328P) | NodeMCU V3 (ESP-12E) |
| Wi-Fi | Separate ESP8266 ESP-01 | Built into NodeMCU |
| Board-to-board comms | UART AT commands | Not needed |
| Voltage divider | Required (5V → 3.3V) | Not needed |
| Wi-Fi code | Manual AT command strings | `WiFi.h` library |
| Number of boards | 2 | 1 |
| Reliability | AT commands sometimes failed | Stable |

---

## 🌐 Web Dashboard

**Live URL:** [https://kanishkdubey1946-del-agobot-smart-i.vercel.app/login.html](https://kanishkdubey1946-del-agobot-smart-i.vercel.app/login.html)

The dashboard includes:
- 🔵 **Live moisture gauge** — real-time current reading
- 📈 **Weekly Chart.js graph** — 7-day moisture trend
- 🔔 **Alert notification banner** — highlights critical conditions
- 🔑 **Device login page** — connect via Device ID, Server IP, Wi-Fi module type, and optional access key

---

## 📈 Current Progress

| Component | Status |
|---|---|
| Hardware assembly & enclosure | ✅ Complete |
| Firmware upload & sensor reading | ✅ Complete |
| Buzzer alert logic | ✅ Complete |
| Website front-end (dashboard + login) | ✅ Complete |
| Server-side API & database connection | 🔧 In Progress |
| Full end-to-end test | ⏳ Pending |

---

## 🔭 Future Work

- **End-to-end integration** — connect NodeMCU HTTP POST to the live database and wire up API endpoints to the dashboard
- **Real-farm deployment** — test across different soil types under real field conditions
- **Automated drainage system** — relay-controlled valve that opens automatically when moisture exceeds the wet threshold
- **Farm security system** — HC-SR04 ultrasonic sensors along farm perimeter to detect animal or human intrusion
- **Multi-node support** — monitor multiple sensors at different field locations from one dashboard

---

## 👨‍💻 Team

**Kanishk Ashish Dubey**
CSDA Program, IIT Patna
Capstone-I Project — 2nd Semester, 2025

---

## 📚 References

- [Arduino Official Documentation](https://www.arduino.cc)
- [Soil Moisture Sensor Module — Components101](https://components101.com/sensors/soil-moisture-sensor-module)
- [ESP8266 AT Instruction Set — Espressif Systems](https://www.espressif.com/en/support/documents/technical-documents)
- [NodeMCU V3 ESP-12E Documentation](https://nodemcu.readthedocs.io)
- Dainik Bhaskar (2021) — Yield loss in Vidarbha due to incorrect watering practices
- The Times of India (2022) — Crop loss across Maharashtra and Madhya Pradesh
- Lokmat (2023) — Onion and tomato losses in Nashik from unmonitored drip irrigation

---

<p align="center">Made with ❤️ at IIT Patna</p>
