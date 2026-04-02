/*
 * AgroBot - Smart Soil Moisture Monitoring System
 * Complete Hardware Code for Arduino Uno + ESP8266
 */

#include <SoftwareSerial.h>

// ==============================================================================
// 🔧 CONFIGURATION SETTINGS - Change these as needed
// ==============================================================================

// --- Wi-Fi Settings ---
#define WIFI_SSID       "YOUR_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// --- Server Settings ---
// Find your computer's IPv4 address using `ipconfig` in command prompt
#define SERVER_IP       "192.168.1.100" 
#define SERVER_PORT     "3000"

// --- Pin Definitions ---
#define SENSOR_PIN      A0
#define BUZZER_PIN      8
#define ESP_RX_PIN      2  // Connect to ESP8266 TX
#define ESP_TX_PIN      3  // Connect to ESP8266 RX

// --- Sensor Thresholds ---
// Calibrate these values based on your soil and sensor
#define DRY_THRESHOLD   300  // Values below this trigger a "Too Dry" alert
#define WET_THRESHOLD   700  // Values above this trigger a "Too Wet" alert

// --- Timing ---
#define READ_INTERVAL   10000 // How often to read sensor and send data (in ms)

// ==============================================================================

SoftwareSerial espSerial(ESP_RX_PIN, ESP_TX_PIN); // RX, TX
bool wifiConnected = false;

/**
 * Sends an AT command to the ESP8266 and waits for a response.
 * @param command The AT command string to send
 * @param timeoutMs Maximum time to wait for a response in milliseconds
 * @return The response string from the ESP8266
 */
String sendATCommand(String command, int timeoutMs) {
  String response = "";
  espSerial.println(command);
  
  long int time = millis();
  while ((time + timeoutMs) > millis()) {
    while (espSerial.available()) {
      char c = espSerial.read();
      response += c;
    }
  }
  
  Serial.print(">> Command: ");
  Serial.println(command);
  Serial.print("<< Response: ");
  Serial.println(response);
  
  return response;
}

/**
 * Initializes the ESP8266 and connects to the specified Wi-Fi network.
 * @return true if connection succeeds, false otherwise
 */
bool connectWiFi() {
  Serial.println("\n--- Initializing Wi-Fi ---");
  
  // 1. Check if module is responding
  String response = sendATCommand("AT", 2000);
  if (response.indexOf("OK") == -1) {
    Serial.println("Error: ESP8266 not responding.");
    return false;
  }
  
  // 2. Set to Station (Client) mode
  response = sendATCommand("AT+CWMODE=1", 2000);
  if (response.indexOf("ERROR") != -1) {
    Serial.println("Error: Could not set CWMODE.");
    return false;
  }
  
  // 3. Connect to Wi-Fi
  Serial.println("Connecting to network: " WIFI_SSID);
  String cmd = "AT+CWJAP=\"";
  cmd += WIFI_SSID;
  cmd += "\",\"";
  cmd += WIFI_PASSWORD;
  cmd += "\"";
  
  // Wi-Fi connection can take several seconds
  response = sendATCommand(cmd, 10000);
  
  if (response.indexOf("WIFI CONNECTED") != -1 || response.indexOf("OK") != -1) {
    Serial.println("Success: Connected to Wi-Fi!");
    return true;
  } else {
    Serial.println("Error: Wi-Fi connection failed.");
    return false;
  }
}

/**
 * Sounds the buzzer with a specific pattern.
 * @param count Number of times to beep
 * @param duration Duration of each beep and pause in milliseconds
 */
void beep(int count, int duration) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < count - 1) { // Pause between beeps, but not after the last one
      delay(duration);
    }
  }
}

/**
 * Checks the raw sensor value against thresholds and triggers alarms if unsafe.
 * @param rawValue The averaged raw ADC reading from the sensor (0-1023)
 */
void checkAndBuzz(int rawValue) {
  if (rawValue < DRY_THRESHOLD) {
    Serial.println("ALERT: Soil is too dry!");
    beep(3, 200); // 3 short beeps
  } else if (rawValue > WET_THRESHOLD) {
    Serial.println("ALERT: Soil is too wet!");
    beep(2, 500); // 2 long beeps
  } else {
    Serial.println("STATUS: Moisture is normal.");
  }
}

/**
 * Sends the calculated moisture percentage to the web server via HTTP POST.
 * @param moisturePct The calculated moisture percentage (0-100)
 */
void sendDataToServer(int moisturePct) {
  Serial.println("\n--- Sending Data to Server ---");
  
  // 1. Open TCP connection to the server
  String cmd = "AT+CIPSTART=\"TCP\",\"";
  cmd += SERVER_IP;
  cmd += "\",";
  cmd += SERVER_PORT;
  
  String response = sendATCommand(cmd, 3000);
  if (response.indexOf("ERROR") != -1 && response.indexOf("ALREADY CONNECT") == -1) {
    Serial.println("Error: Could not connect to server.");
    return;
  }
  
  // 2. Build the HTTP POST request payload
  String postData = "moisture=" + String(moisturePct);
  
  // 3. Build the HTTP headers
  String httpRequest = "POST /save_data.php HTTP/1.1\r\n";
  httpRequest += "Host: " + String(SERVER_IP) + ":" + String(SERVER_PORT) + "\r\n";
  httpRequest += "Content-Type: application/x-www-form-urlencoded\r\n";
  httpRequest += "Content-Length: " + String(postData.length()) + "\r\n";
  httpRequest += "Connection: close\r\n\r\n";
  httpRequest += postData;
  
  // 4. Send the total byte length first
  int length = httpRequest.length();
  cmd = "AT+CIPSEND=" + String(length);
  response = sendATCommand(cmd, 2000);
  
  if (response.indexOf(">") != -1) {
    // 5. Send the actual HTTP request
    Serial.println("Sending HTTP POST...");
    response = sendATCommand(httpRequest, 3000); // Wait for server to process and reply
    
    if (response.indexOf("SEND OK") != -1) {
      Serial.println("Success: Data sent to server!");
    } else {
      Serial.println("Error: Failed to send data.");
    }
  } else {
    Serial.println("Error: AT+CIPSEND failed.");
  }
  
  // 6. Ensure connection is closed
  sendATCommand("AT+CIPCLOSE", 1000);
}

void setup() {
  // Initialize Serial Monitor
  Serial.begin(9600);
  
  // Initialize ESP8266 SoftwareSerial
  espSerial.begin(9600);
  
  // Configure Pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(SENSOR_PIN, INPUT);
  
  Serial.println("=========================================");
  Serial.println(" AgroBot Hardware Initialized");
  Serial.println("=========================================");
  
  // Attempt initial Wi-Fi connection
  wifiConnected = connectWiFi();
}

void loop() {
  Serial.println("\n--- New Reading Cycle ---");
  
  // 1. Read and average moisture sensor value from A0
  long sum = 0;
  for (int i = 0; i < 5; i++) {
    sum += analogRead(SENSOR_PIN);
    delay(50); // Small delay to stabilize reading
  }
  int rawValue = sum / 5;
  
  // 2. Convert to percentage using map() and constrain()
  // Assuming 1023 is dry (0%) and 0 is wet (100%)
  // Note: Your sensor output may vary. If 0 is dry and 1023 is wet, swap 0 and 1023 in the map function.
  int mappedPct = map(rawValue, 1023, 0, 0, 100);
  int moisturePct = constrain(mappedPct, 0, 100);
  
  // 3. Print raw value and percentage to Serial Monitor
  Serial.print("Raw ADC Value: ");
  Serial.print(rawValue);
  Serial.print(" | Moisture: ");
  Serial.print(moisturePct);
  Serial.println("%");
  
  // 4. Call checkAndBuzz() to handle buzzer based on thresholds
  checkAndBuzz(rawValue);
  
  // 5. Check if wifiConnected is false — if so try connectWiFi() again
  if (!wifiConnected) {
    Serial.println("Wi-Fi disconnected. Attempting to reconnect...");
    wifiConnected = connectWiFi();
  }
  
  // 6. If wifiConnected is true call sendDataToServer(moisturePct)
  if (wifiConnected) {
    sendDataToServer(moisturePct);
  } else {
    Serial.println("Skipping data upload due to no Wi-Fi connection.");
  }
  
  // 7. Wait before the next reading
  Serial.print("Waiting ");
  Serial.print(READ_INTERVAL / 1000);
  Serial.println(" seconds...");
  delay(READ_INTERVAL);
}

/*
 * ==============================================================================
 * HARDWARE GUIDE & TROUBLESHOOTING
 * ==============================================================================
 * 
 * 1. Wiring Guide:
 *    - Soil Moisture Sensor: VCC -> 5V, GND -> GND, A0 -> Arduino A0
 *    - Buzzer: Positive (+) Leg -> Arduino Pin 8, Negative (-) Leg -> GND
 *    - ESP8266:
 *        - VCC -> 3.3V (Do NOT connect to 5V!)
 *        - GND -> GND
 *        - TX -> Arduino Pin 2 Connect via logic level converter or voltage divider if needed for safety
 *        - RX -> Arduino Pin 3 (Needs a voltage divider! ESP takes 3.3V max logic, Arduino sends 5V)
 *        - CH_PD (or EN) -> 3.3V (Must be pulled high for module to turn on)
 * 
 * 2. Changing Wi-Fi / Server Setup:
 *    Modify the `#define WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_IP` values at the top of this file.
 * 
 * 3. Calibrating Thresholds:
 *    Upload the code and open Serial Monitor (9600 baud).
 *    Insert the sensor into dry soil and note the "Raw ADC Value". Put that as DRY_THRESHOLD.
 *    Insert the sensor into completely wet soil and note the value. Put that as WET_THRESHOLD.
 * 
 * 4. Buzzer Alert Meanings:
 *    - 3 Short Beeps: Soil is TOO DRY (Raw ADC < DRY_THRESHOLD)
 *    - 2 Long Beeps: Soil is TOO WET (Raw ADC > WET_THRESHOLD)
 *    - Silence: Soil moisture is Optimal.
 * 
 * 5. Checking Upload Status:
 *    The Serial Monitor will show:
 *    >> Command: AT+CIPSEND=XXXX
 *    << Response: >
 *    Sending HTTP POST...
 *    ... SEND OK
 *    If it doesn't say SEND OK, verify your computer's IP address and ensure the Python server is running.
 */
