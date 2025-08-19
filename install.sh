#!/bin/bash

# Exit on error
set -e

echo "Starting Poker Night application setup..."

# Update package repositories
echo "Updating package repositories..."
apt-get update -y

# Install Python3, pip, and virtual environment support
echo "Installing Python3 and dependencies..."
apt-get install -y python3 python3-full python3-venv

# Create a virtual environment
echo "Creating virtual environment..."
python3 -m venv /root/poker-night/venv

# Install Python dependencies in virtual environment
echo "Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    /root/poker-night/venv/bin/pip install -r requirements.txt
else
    echo "Warning: requirements.txt not found."
    # You may need to add specific package installations here if known
fi

# Create systemd service file
echo "Creating systemd service for auto-start..."
cat > /etc/systemd/system/poker-night.service << EOL
[Unit]
Description=Poker Night Application
After=network.target

[Service]
ExecStart=/root/poker-night/venv/bin/python /root/poker-night/backend/run.py
Restart=always
User=root
Group=root
Environment=PATH=/usr/bin:/usr/local/bin:/root/poker-night/venv/bin
WorkingDirectory=/root/poker-night/backend

[Install]
WantedBy=multi-user.target
EOL

# Enable and start the service
echo "Enabling and starting the service..."
systemctl daemon-reload
systemctl enable poker-night.service
systemctl start poker-night.service

echo "Installation completed successfully! Poker Night application is now running and will start automatically on system boot."
