# SIMMS hardware setup: every command in one place

Step-by-step commands for the laptop (server), the ESP32 node and the Raspberry Pi camera node, plus fixes for every problem we have hit so far. Run things in the order of sections 1 → 2 → 3.

**Names used below.** Change them if yours differ.

| Thing | Value |
|---|---|
| Wi-Fi (2.4 GHz, WPA2) | `Galaxy_M04_9212` (phone hotspot) |
| Laptop IP | from `ipconfig` (was `192.168.14.122`) |
| Pi hostname / user | `simms` / `simms_pi` → `ssh simms_pi@simms.local` |
| Pi IP | from the hotspot's device list (was `192.168.14.14`) |
| Repo / branch | `https://github.com/Raghvendra-1406/SIMMS.git` / `anuj` |
| Room | `R101` |

## Golden rules

1. **Never run `sudo apt full-upgrade` on the Pi.** It broke Wi-Fi twice. Install only the packages listed below.
2. **Never pull the Pi's power while it's running.** Always run `sudo shutdown -h now` and wait until the green LED stops blinking.
3. **Run long jobs on the Pi inside `tmux`**, so they survive an SSH disconnect.
4. **Laptop, Pi and ESP32 must be on the same 2.4 GHz WPA2 network.** No college Wi-Fi with a login page.
5. **Never commit passwords.** `backend/.env` and `firmware/simms_node/src/secrets.h` are git-ignored.

---

## 1. Laptop (broker, backend, dashboard)

### 1.1 Find the laptop's IP
```powershell
ipconfig
```
Use the **IPv4 Address** under *Wireless LAN adapter Wi-Fi*. It can change when the hotspot restarts; if it does, update `secrets.h` (ESP32) and the Pi's `.env`.

### 1.2 Let other devices reach Mosquitto (once)
Open Notepad **as administrator**, open `C:\Program Files\mosquitto\mosquitto.conf`, and add at the end:
```
listener 1883 0.0.0.0
allow_anonymous true
```
Then, in **PowerShell as administrator**:
```powershell
Restart-Service mosquitto
New-NetFirewallRule -DisplayName "Mosquitto 1883" -Direction Inbound -Protocol TCP -LocalPort 1883 -Action Allow -Profile Private,Public
```
Also set the Wi-Fi network profile to **Private** in Windows settings, and stop the laptop sleeping while plugged in: Settings → System → Power → Screen and sleep → **Never**.

### 1.3 Start the backend and dashboard
```powershell
# terminal 1: backend
cd backend
.venv\Scripts\activate
uvicorn main:app --reload

# terminal 2: dashboard
cd frontend
npm run dev
```
Open http://localhost:5173, then go to **Live monitor → R101**.

### 1.4 Push code so the Pi can pull it
```powershell
git status
git add <files>
git commit -m "..."
git push origin anuj
```

### 1.5 Laptop as the camera (fallback if the Pi is not ready)
```powershell
cd backend
.venv\Scripts\activate
python -m models.camera_capture --source 0 --snapshot room.jpg              # photo for Admin -> Calibration
python -m models.vision_runtime --room-name R101 --source 0 --interval 30 --show
```

---

## 2. ESP32 node

### 2.1 USB driver
The board's USB chip is a **CP2102**. If Device Manager shows *"CP2102 USB to UART Bridge Controller"* under **Other devices** with a yellow warning:
1. Download **CP210x Universal Windows Driver** from silabs.com and extract it.
2. Device Manager → right-click the device → **Update driver → Browse my computer** → pick the extracted folder.
3. It appears under **Ports (COM & LPT)** as *Silicon Labs CP210x … (COM5)*.

If no device appears at all, the micro-USB cable is charge-only; use a data cable.

### 2.2 Wi-Fi and broker settings: `firmware/simms_node/src/secrets.h`
Create it once with `copy src\secrets.example.h src\secrets.h`, then edit:
```c
#define WIFI_SSID "Galaxy_M04_9212"
#define WIFI_PASSWORD "your-hotspot-password"
#define MQTT_HOST "192.168.14.122"     // laptop IPv4 from ipconfig
```

### 2.3 Build, upload, monitor
**In VS Code** (PlatformIO IDE extension, *File → Open Folder → `firmware/simms_node`*):
1. Left panel → **PlatformIO → Project Tasks → `hw` → General → Upload**. Use `hw`, never `Default` or `sim`.
2. Then **`hw` → General → Monitor**, and press **EN** on the board.

**Or from a terminal:**
```powershell
cd firmware\simms_node
pio run -e hw -t upload
pio device monitor -b 115200
```
If the upload hangs at `Connecting.....____`, **hold BOOT** until `Writing at 0x...` appears.

A good log looks like this:
```
SIMMS node esp32-R101 (fw 2.0.0, HARDWARE)
[wifi] connecting to Galaxy_M04_9212..... connected, IP 192.168.14.102
[mqtt] connecting to 192.168.14.122:1883 ... connected
[sensor] V=nan lights=nanA fans=nanA main=nanA T=28.0 H=60.0
```
`V=nan` and `no meter responding` are normal until the PZEM's AC side is powered (Phase 2).

### 2.4 Wiring (unplug USB before touching wires)
All modules use **3V3 and GND** from the ESP32. Share them on a breadboard rail. Use female-to-female jumpers between module pins and ESP32 pins.

| Module | Module pin | ESP32 pin |
|---|---|---|
| DHT11 | `+` / VCC | 3V3 |
| | `−` / GND | GND |
| | OUT / DATA | **D15** (GPIO15) |
| LDR (3-pin, digital) | VCC | 3V3 |
| | GND | GND |
| | **DO** | **VP** (GPIO36) |
| PZEM-004T (TTL side only) | 5V | 3V3 (5V/VIN plus a 1k/2k divider on TX if it won't answer on 3V3) |
| | GND | GND |
| | TX | **RX2 / GPIO16** |
| | RX | **TX2 / GPIO17** |

- **LDR threshold:** turn the blue knob until the module's LED just flips under room light. The dashboard then shows 0 % (dark) or 100 % (bright).
- **PZEM:** don't touch the screw terminals (AC voltage and CT coil) without a qualified supervisor. The meter only answers once its AC side is powered.

### 2.5 ESP32 troubleshooting
| Log | Fix |
|---|---|
| `[wifi] connecting.....` forever | Wrong SSID or password in `secrets.h`, the network is 5 GHz-only, or WPA3. Use 2.4 GHz WPA2. |
| `[mqtt] ... failed (state -2)` | The broker isn't reachable: check `MQTT_HOST`, section 1.2 (listener and firewall), and that the laptop is on the same network. |
| `failed (state 5)` | Add `allow_anonymous true` to `mosquitto.conf`. |
| `DHT read failed` | OUT must be on D15 and VCC on 3V3. |
| Garbage characters in the monitor | Set the baud rate to 115200. |

---

## 3. Raspberry Pi 4 (camera node)

### 3.1 Flash the SD card (Raspberry Pi Imager)
**Device:** Raspberry Pi 4. **OS:** Raspberry Pi OS (64-bit). **Storage:** the SD card. Then **Edit settings**:
- **General** tab:
  - [x] Hostname `simms`
  - [x] **Username and password:** `simms_pi` and a password **you write down**. Without a password nobody can log in.
  - [x] Wireless LAN: the hotspot name and password (case-sensitive), country **IN**
  - [x] Locale: Asia/Kolkata, keyboard `us`
- **Services** tab:
  - [x] Enable SSH → **Use password authentication**

Click **Save**, then **Yes** at *"apply OS customisation settings?"* (clicking No skips your Wi-Fi and user settings!), then wait until the write **and verify** finish.

**Power:** use a USB-C supply labelled **5V⎓3A**. A laptop USB port is not enough.

### 3.2 First boot and connecting
Wait **5 minutes**: the first boot restarts once before Wi-Fi comes up.
```powershell
ping simms.local
arp -a                                    # list devices if simms.local doesn't resolve
ssh-keygen -R simms.local                 # clear old keys after every re-flash
ssh-keygen -R 192.168.14.14
ssh -o ServerAliveInterval=30 simms_pi@simms.local      # or simms_pi@<pi-ip>
```
Type `yes` at the trust question, then the password. Nothing shows on screen while you type it.

### 3.3 Base setup (right after the first login)
```bash
# Wi-Fi: power saving off and plain WPA2 (finds the connection's name itself)
NAME=$(nmcli -t -f NAME,TYPE con show --active | grep 802-11-wireless | cut -d: -f1)
echo "Wi-Fi connection: $NAME"
sudo nmcli con modify "$NAME" wifi.powersave 2 wifi-sec.key-mgmt wpa-psk
nmcli con show "$NAME" | grep -E "powersave|key-mgmt"     # expect "2 (disable)" and "wpa-psk"
sudo iw wlan0 set power_save off                          # apply now, without a reboot

# stop updates from ever replacing the Wi-Fi driver or kernel
sudo apt-mark hold firmware-brcm80211 raspi-firmware linux-image-rpi-v8 linux-image-rpi-2712

# only the packages we need: NO full-upgrade
sudo apt update
sudo apt install -y git python3-venv libgl1 v4l-utils tmux
```

### 3.4 Health checks (run any time)
```bash
vcgencmd get_throttled            # must be throttled=0x0; anything else = weak charger or cable
v4l2-ctl --list-devices           # webcam (Logitech C270) -> /dev/video0 -> use --source 0
df -h /                           # free space
dmesg | grep -i "EXT4-fs error"   # must print nothing; anything = damaged filesystem (see 4.4)
uptime                            # how long since the last boot
```
To watch the power during a heavy job, open a second SSH window and run:
```bash
watch -n 2 vcgencmd get_throttled
```

### 3.5 Get the code
```bash
cd ~
git clone --branch anuj https://github.com/Raghvendra-1406/SIMMS.git
cd SIMMS && git fsck --no-dangling
git log --oneline -1
```
**GitHub login:** your username, and as the password a **personal access token**. Create one under GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate, with the `repo` scope ticked.

To update later: `cd ~/SIMMS && git pull`

### 3.6 Install the camera software (small, ~250 MB, no PyTorch)
```bash
tmux new -s setup
cd ~/SIMMS/backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install --no-cache-dir -r requirements-pi.txt
python -c "import cv2, onnxruntime, numpy; print('ok', cv2.__version__, onnxruntime.__version__)"
ls -la models/weights/yolo11n.onnx
```
Do **not** install `requirements.txt` + `requirements-vision.txt` on the Pi: they pull PyTorch and NVIDIA packages (3–4 GB) and filled the card.

**tmux:**

| Action | Command |
|---|---|
| Start | `tmux new -s setup` |
| Leave it running | **Ctrl+B**, then **D** |
| Come back | `tmux attach -t setup` |
| List sessions | `tmux ls` |

### 3.7 Settings file `.env` (database and broker)
```powershell
# on the laptop, from the repo folder
scp backend\.env simms_pi@simms.local:~/SIMMS/backend/.env
```
```bash
# on the Pi: point the broker at the laptop, keep DATABASE_URL as it is
nano ~/SIMMS/backend/.env
#   MQTT_BROKER_HOST=192.168.14.122
# save: Ctrl+O, Enter; exit: Ctrl+X
```

### 3.8 Camera tests
```bash
cd ~/SIMMS/backend && source .venv/bin/activate
python -m models.camera_capture --source 0 --snapshot snap.jpg
python -m models.vision_runtime --room-name R101 --source 0 --interval 30 --cycles 3
```
```powershell
# laptop: fetch the snapshot, then upload it in Admin -> Calibration and draw the boxes
scp simms_pi@simms.local:~/SIMMS/backend/snap.jpg .
```
**Pass:** the dashboard shows **Camera: Online**, and the people count changes when someone steps into view.

### 3.9 Add another Wi-Fi network (keeps the hotspot as backup)
```bash
sudo nmcli con add type wifi ifname wlan0 con-name home ssid "Ghatotkach" \
  wifi-sec.key-mgmt wpa-psk wifi-sec.psk "brahminnavhta" \
  wifi.powersave 2 connection.autoconnect-priority 10
nmcli con show
sudo nmcli con up home        # switch now (SSH freezes; reconnect on the new network)
```

### 3.10 Shutdown and reboot
```bash
sudo shutdown -h now          # wait for the green LED to stop, then unplug
sudo reboot
```

### 3.11 Make the SD card read-only (for the 7-day run and demo, after everything works)
Stops all writes to the card so it can't be corrupted. Changes made while it's on are lost at reboot.
```bash
sudo raspi-config             # Performance Options -> Overlay File System -> Yes (also make boot read-only: Yes)
sudo reboot
```
To update code later, turn it off the same way, reboot, `git pull`, then turn it back on.

---

## 4. Troubleshooting

### 4.1 Pi not joining Wi-Fi after flashing
1. Wait 5 minutes, then check the hotspot's connected-devices list for `simms`, or run `arp -a`.
2. Hotspot settings: **2.4 GHz**, **WPA2-Personal** (not WPA3 or "WPA2/WPA3"), *auto-off when no devices connected* **off**.
3. Check what Imager wrote:
   - wait until the green LED has been still for about 10 s, then unplug;
   - put the card in the laptop and open **bootfs → `network-config`**;
   - the network name and password must match exactly. If the file is missing or wrong, re-flash and click **Yes** at "apply OS customisation".
4. LAN-cable fallback:
   - connect the Pi to the router, or to the laptop with Wi-Fi adapter → Properties → **Sharing** turned on;
   - then `ssh simms_pi@simms.local` and run `sudo nmcli dev wifi connect "Name" password "Pass"`.

With a monitor (micro-HDMI) and keyboard:
```bash
nmcli dev status
nmcli dev wifi list
sudo nmcli dev wifi connect "YourWiFiName" password "YourPassword"
journalctl -b -u NetworkManager --no-pager | tail -30
iw reg get                    # expect country IN
```

### 4.2 SSH errors
| Error | Fix |
|---|---|
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | Expected after a re-flash: `ssh-keygen -R simms.local` and `ssh-keygen -R <pi-ip>` |
| `Permission denied (publickey,password)` | Wrong username or password. The user is `simms_pi`. Check Imager → Edit settings → Username. If no password was set, re-flash. |
| `Could not resolve hostname simms.local` | Use the IP: `ssh simms_pi@<pi-ip>` |
| `client_loop: send disconnect` | Only SSH dropped. Reconnect, then `tmux attach -t setup`. |

### 4.3 Broken git clone (`is not a GIT packfile`, `bad object`)
```bash
cd ~ && rm -rf SIMMS
git clone --branch anuj https://github.com/Raghvendra-1406/SIMMS.git
cd SIMMS && git fsck --no-dangling
```

### 4.4 Damaged filesystem (`Bad message`, `EXT4-fs error`, `dpkg: error: parsing file`)
```bash
dmesg | grep -iE "ext4|mmc|I/O error" | tail -20
```
- **`EXT4-fs error` only:** the filesystem is damaged. Try a repair on the next boot:
  ```bash
  sudo sed -i '1 s/$/ fsck.mode=force fsck.repair=yes/' /boot/firmware/cmdline.txt
  cat /boot/firmware/cmdline.txt        # must stay ONE line
  sudo reboot                           # wait 5 min
  sudo sed -i 's/ fsck.mode=force fsck.repair=yes//' /boot/firmware/cmdline.txt
  ```
  If the errors persist, or `sudo dpkg --verify` shows a parsing error, **re-flash**.
- **`mmc` or `I/O error`:** the card is failing. Test it on the laptop with **H2testw** (Write + Verify).
- Work around a folder that won't delete: `mv ~/.cache/pip ~/.cache/pip-broken`
- Prevention: weak power under load is the prime suspect. Watch `watch -n 2 vcgencmd get_throttled` during installs, always shut down properly, and turn on the read-only mode (3.11) for long runs.

### 4.5 Under-voltage
`vcgencmd get_throttled` showing anything other than `0x0` (for example `0x50000` or `0x50005`) means the voltage dropped. Use a different **5V⎓3A USB-C** charger, or a shorter, thicker cable.
