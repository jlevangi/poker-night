#!/bin/bash

# Exit on error
set -e

echo "Starting Poker Night application setup..."

# Check if service is already running and stop it
if systemctl is-active --quiet poker-night.service; then
    echo "Stopping existing Poker Night service..."
    systemctl stop poker-night.service
fi

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
    echo "Upgrading pip..."
    /root/poker-night/venv/bin/pip install --upgrade pip
    echo "Installing requirements..."
    /root/poker-night/venv/bin/pip install -r requirements.txt
else
    echo "Warning: requirements.txt not found."
    # Install essential packages if requirements.txt is missing
    /root/poker-night/venv/bin/pip install Flask Flask-SQLAlchemy Werkzeug python-dotenv pywebpush py-vapid cryptography
fi

# Ensure .env file exists with default values if missing
echo "Checking environment configuration..."
if [ ! -f "/root/poker-night/.env" ]; then
    echo "Creating default .env file..."
    cat > /root/poker-night/.env << 'EOL'
# Frontend Configuration
APP_VERSION=1.0.5

# Backend Configuration
# Admin authentication settings
# Password hash for admin interface (default password: admin123)
ADMIN_PASSWORD_HASH=scrypt:32768:8:1$bRHPOEGg0fSjnCi5$f4bdd17975b9769d97714236388c1334156461608a9425b63469333811104f72e9ac39d1448258c3b0870069aa59323dcf33a328d567508b01761e7afa85e2c2

# Push Notification Settings
VAPID_EMAIL=admin@yourpokerapp.com

# VAPID keys will be auto-generated on first run if not present
# Database settings (if not using default)
# DATABASE_URL=sqlite:///poker_data/sessions.db
EOL
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
RestartSec=3
User=root
Group=root
Environment=PATH=/usr/bin:/usr/local/bin:/root/poker-night/venv/bin
Environment=PYTHONPATH=/root/poker-night/backend
WorkingDirectory=/root/poker-night
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOL

# Create directories for data persistence if they don't exist
echo "Creating data directories..."
mkdir -p /root/poker-night/poker_data
mkdir -p /root/poker-night/poker_data/archives

# Set proper permissions
echo "Setting permissions..."
chmod +x /root/poker-night/backend/run.py
chmod -R 755 /root/poker-night

# Enable and start the service
echo "Enabling and starting the service..."
systemctl daemon-reload
systemctl enable poker-night.service

# Start the service and show status
echo "Starting Poker Night service..."
systemctl start poker-night.service

# Wait a moment for service to start
sleep 3

# Show service status
echo "Service status:"
systemctl status poker-night.service --no-pager

# Show recent logs
echo "Recent logs:"
journalctl -u poker-night.service -n 10 --no-pager

echo ""
echo "Installation completed successfully!"
echo "Poker Night application is now running and will start automatically on system boot."
echo ""
echo "To check logs: journalctl -u poker-night.service -f"
echo "To restart: systemctl restart poker-night.service"
echo "To stop: systemctl stop poker-night.service"
