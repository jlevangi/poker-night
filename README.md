# Poker Night Application

A web-based application to manage poker games, track scores, and enhance your poker night experience.

## 🃏 Features

- Poker game management
- Player tracking
- Score history
- Real-time game updates

## 📋 Prerequisites

- Linux system with systemd
- Internet connection for package installation

## 🚀 Installation

### Automatic Installation

The easiest way to set up the Poker Night application is by using the provided installation script:

```bash
# Clone the repository (if you haven't already)
git clone https://github.com/yourusername/poker-night.git
cd poker-night

# Make the installation script executable
chmod +x install.sh

# Run the installation script with root privileges
sudo ./install.sh
```

The installation script will:
- Install Python and required dependencies
- Set up a Python virtual environment
- Install required Python packages
- Create and enable a systemd service for automatic startup

### Manual Installation

If you prefer to set up manually:

1. Install Python and dependencies:
   ```bash
   sudo apt-get update -y
   sudo apt-get install -y python3 python3-full python3-venv
   ```

2. Create a virtual environment:
   ```bash
   python3 -m venv /root/poker-night/venv
   ```

3. Install Python packages:
   ```bash
   /root/poker-night/venv/bin/pip install -r requirements.txt
   ```

4. Create a systemd service file at `/etc/systemd/system/poker-night.service`

5. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable poker-night.service
   sudo systemctl start poker-night.service
   ```

## 💻 Usage

Once installed, the application will automatically start on system boot.

- Access the web interface at: `http://your-server-ip:port`
- Manage games through the web dashboard
- Track player statistics and game history

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!