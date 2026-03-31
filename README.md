# AgroBot 🌱

An IoT-based soil moisture detection and monitoring system designed to help farmers manage irrigation efficiently using real-time data.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Components](#components)
- [System Architecture](#system-architecture)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Setup & Installation](#setup--installation)
- [Future Work](#future-work)
- [References](#references)

---

## Overview

AgroBot addresses the problem of poor irrigation management in agriculture. Both over-irrigation and under-irrigation lead to significant crop losses. A key issue is the lack of affordable, real-time soil moisture monitoring, forcing farmers to rely on guesswork.

This project uses IoT to build a compact device that:
- Reads soil moisture levels continuously using a sensor
- Sends data to a web dashboard over Wi-Fi in real time
- Triggers a local buzzer alert when moisture is outside the safe range
- Displays a weekly moisture trend report on the website

---

## Features

- 📡 **Real-time monitoring** – Moisture data sent to a web server via Wi-Fi
- 🔔 **Local alerts** – Piezoelectric buzzer beeps when soil is too dry or too wet
- 📊 **Weekly report** – 7-day moisture trend chart on the dashboard
- 🔐 **User authentication** – Secure login system for the web interface
- 📦 **Compact design** – All components enclosed in a single portable unit

---

## Components

| Component | Role |
|---|---|
| Arduino Uno (ATmega328P) | Central microcontroller; reads sensor, controls buzzer, sends data |
| Resistive Soil Moisture Sensor | Measures soil water content via electrical resistance |
| ESP8266 Wi-Fi Module | Handles wireless communication via AT commands + HTTP POST |
| Piezoelectric Buzzer | Local alert when moisture is out of safe range |

---

## System Architecture

```
Soil Moisture Sensor
        │
        ▼ (Analog voltage → A0 pin)
  Arduino Uno (ADC → moisture %)
        │
        ├──► Buzzer (if out of range)
        │
        ▼ (UART / AT commands)
   ESP8266 Wi-Fi Module
        │
        ▼ (HTTP POST)
     Web Server
        │
        ▼
   Website Dashboard
   (Live reading + Weekly report)
```

**Data flow:** `Moisture Sensor → Arduino → Wi-Fi → Web Server → Website`

---

## How It Works

### Hardware

1. The moisture sensor probes are inserted into the soil. The analog voltage output is read on Arduino pin `A0`.
2. The Arduino's on-chip ADC converts the voltage to a 10-bit value (0–1023), which is mapped to a moisture percentage.
3. If the percentage falls below the **lower threshold** (too dry) or above the **upper threshold** (too wet), the Arduino sets pin `8` HIGH to trigger the buzzer.
4. The Arduino sends AT commands to the ESP8266 over UART serial to connect to Wi-Fi and POST the moisture reading to the web server.

### Software / Website

- **Live view** – Displays the current moisture percentage.
- **Weekly report** – Chart showing moisture readings over the past 7 days.
- **Authentication** – Login system for secure access.
- **Server-side storage** – Sensor readings stored in a database.

---

## Project Structure

```
agrobot/
├── arduino/
│   └── agrobot.ino          # Main Arduino sketch
├── website/
│   ├── frontend/            # HTML/CSS/JS dashboard
│   └── backend/             # Server-side logic & database
├── enclosure/               # Enclosure design files
└── README.md
```

---

## Setup & Installation

### Hardware

1. Wire the soil moisture sensor analog output → Arduino `A0`
2. Wire the buzzer → Arduino digital pin `8`
3. Connect ESP8266 TX/RX to Arduino UART pins
4. Power the Arduino via USB or 5V adapter

### Arduino

1. Open `arduino/agrobot.ino` in the [Arduino IDE](https://www.arduino.cc/en/software)
2. Set your Wi-Fi credentials and server endpoint in the sketch
3. Upload to the Arduino Uno board

### Website

```bash
# Clone the repository
git clone https://github.com/your-username/agrobot.git
cd agrobot/website/backend

# Install dependencies (example for Node.js)
npm install

# Start the server
node server.js
```

> Update the Arduino sketch with your server's IP/domain before uploading.

---

## Future Work

- **Automated drainage** – Relay-controlled drainage valve activated when moisture is too high
- **Farm security** – HC-SR04 ultrasonic sensors along the farm boundary to detect intrusions
- **Animal deterrent system** – On intrusion detection: buzzer alarm, PIR-activated floodlight, electric fence pulse, SMS alert via SIM800L GSM, servo-controlled water sprinkler
- **Multi-node deployment** – Support for multiple sensor nodes covering larger farm areas
- **Field testing** – Real-world deployment and testing under actual agricultural conditions

---

## References

1. [Arduino Official Documentation](https://www.arduino.cc)
2. Soil Moisture Sensor Module – Working and Pinout. Components101, 2021.
3. [ESP8266 AT Instruction Set and Wi-Fi Module Guide](https://www.espressif.com) – Espressif Systems.
4. IoT Based Soil Moisture Monitoring System for Smart Irrigation. IJERT, Vol. 9, 2020.
5. [Sensor Partners – IoT Sensor Resources](https://sensorpartners.com)

---

## License

This project is licensed under the [MIT License](LICENSE).

```
MIT License

Copyright (c) 2026 AgroBot Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
