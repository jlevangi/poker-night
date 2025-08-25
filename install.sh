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

# Install Python3, pip, virtual environment support, and rsync
echo "Installing Python3 and dependencies..."
apt-get install -y python3 python3-full python3-venv rsync

# Create a virtual environment outside the git repo
echo "Creating virtual environment..."
python3 -m venv $APP_DIR/venv

# Install Python dependencies in virtual environment
echo "Installing Python dependencies..."
if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo "Upgrading pip..."
    $APP_DIR/venv/bin/pip install --upgrade pip
    echo "Installing requirements..."
    $APP_DIR/venv/bin/pip install -r "$SCRIPT_DIR/requirements.txt"
else
    echo "Warning: requirements.txt not found."
    # Install essential packages if requirements.txt is missing
    $APP_DIR/venv/bin/pip install Flask Flask-SQLAlchemy Werkzeug python-dotenv pywebpush py-vapid cryptography
fi

# Ensure .env file exists with default values if missing
echo "Checking environment configuration..."
if [ ! -f "$APP_DIR/.env" ]; then
    echo "Creating default .env file..."
    cat > $APP_DIR/.env << 'EOL'
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
ExecStart=$APP_DIR/venv/bin/python $APP_DIR/backend/run.py
Restart=always
RestartSec=3
User=root
Group=root
Environment=PATH=/usr/bin:/usr/local/bin:$APP_DIR/venv/bin
Environment=PYTHONPATH=$APP_DIR/backend
WorkingDirectory=$APP_DIR
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOL

# Create directories for data persistence if they don't exist
echo "Creating data directories..."
mkdir -p $APP_DIR/poker_data
mkdir -p $APP_DIR/poker_data/archives

# Copy application files if running from a different location
if [ "$SCRIPT_DIR" != "$APP_DIR" ]; then
    echo "Copying application files from $SCRIPT_DIR to $APP_DIR..."
    
    # Check if source directory has the expected structure
    if [ ! -d "$SCRIPT_DIR/backend" ]; then
        echo "ERROR: backend directory not found in $SCRIPT_DIR"
        echo "Contents of $SCRIPT_DIR:"
        ls -la "$SCRIPT_DIR"
        exit 1
    fi
    
    # Copy files
    rsync -av --exclude='.git' --exclude='venv' --exclude='__pycache__' --exclude='*.pyc' "$SCRIPT_DIR/" "$APP_DIR/"
    
    echo "File copy completed. Verifying structure..."
    if [ -d "$APP_DIR/backend" ]; then
        echo "✓ Backend directory copied successfully"
    else
        echo "✗ Backend directory missing after copy"
        exit 1
    fi
else
    echo "Running from app directory, skipping file copy..."
fi

# Set proper permissions (only on app directory, not git repo)
echo "Setting permissions..."
if [ -f "$APP_DIR/backend/run.py" ]; then
    chmod +x $APP_DIR/backend/run.py
    echo "Made backend/run.py executable"
else
    echo "Warning: backend/run.py not found at $APP_DIR/backend/run.py"
fi
chmod -R 755 $APP_DIR

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
