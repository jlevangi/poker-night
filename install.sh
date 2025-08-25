#!/bin/bash

# Exit on error
set -e

echo "Starting Poker Night application setup..."

# Get the actual script directory (not the symlink)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/root/poker-night"

echo "=== DEBUGGING PATH INFORMATION ==="
echo "Script directory: '$SCRIPT_DIR'"
echo "App directory: '$APP_DIR'"
echo "Current working directory: '$(pwd)'"
echo "Script name: '${BASH_SOURCE[0]}'"
echo "==================================="

# Determine deployment mode early
if [ "$SCRIPT_DIR" = "/root/poker-night" ]; then
    echo "=== PRODUCTION MODE ==="
    echo "Running from production app directory: $SCRIPT_DIR"
    echo "Will update dependencies and restart service without file copy"
    DEPLOYMENT_MODE="production"
    APP_DIR="$SCRIPT_DIR"  # Set APP_DIR to current directory for production mode
else
    echo "=== DEPLOYMENT MODE ==="
    echo "Running from git repository: $SCRIPT_DIR"
    echo "Will copy files to production and restart service"
    DEPLOYMENT_MODE="deployment"
fi

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

# Handle virtual environment based on deployment mode
if [ "$DEPLOYMENT_MODE" = "deployment" ]; then
    # Create/update virtual environment for deployment
    echo "Creating/updating virtual environment..."
    python3 -m venv $APP_DIR/venv
    
    echo "Installing Python dependencies..."
    if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
        echo "Upgrading pip..."
        $APP_DIR/venv/bin/pip install --upgrade pip
        echo "Installing requirements from git repo..."
        $APP_DIR/venv/bin/pip install -r "$SCRIPT_DIR/requirements.txt"
    else
        echo "Warning: requirements.txt not found in git repo."
        $APP_DIR/venv/bin/pip install Flask Flask-SQLAlchemy Werkzeug python-dotenv pywebpush py-vapid cryptography
    fi
    
elif [ "$DEPLOYMENT_MODE" = "production" ]; then
    # Update existing virtual environment in production
    if [ ! -d "$APP_DIR/venv" ]; then
        echo "Creating new virtual environment in production..."
        python3 -m venv $APP_DIR/venv
    else
        echo "Updating existing virtual environment..."
    fi
    
    echo "Installing/updating Python dependencies..."
    if [ -f "$APP_DIR/requirements.txt" ]; then
        echo "Upgrading pip..."
        $APP_DIR/venv/bin/pip install --upgrade pip
        echo "Installing requirements from production app..."
        $APP_DIR/venv/bin/pip install -r "$APP_DIR/requirements.txt"
    else
        echo "Warning: requirements.txt not found in production app."
        $APP_DIR/venv/bin/pip install --upgrade Flask Flask-SQLAlchemy Werkzeug python-dotenv pywebpush py-vapid cryptography
    fi
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

# Deployment mode already determined above

# Backup database before making changes
if [ -f "$APP_DIR/poker_data/poker_night.db" ]; then
    echo "Backing up database..."
    cp "$APP_DIR/poker_data/poker_night.db" "$APP_DIR/poker_data/poker_night.db.backup.$(date +%Y%m%d_%H%M%S)"
    echo "Database backed up"
fi

# Handle file operations based on deployment mode
if [ "$DEPLOYMENT_MODE" = "deployment" ]; then
    # Copy application files from git repo to app directory
    echo "Copying application files from $SCRIPT_DIR to $APP_DIR..."
    
    # Check if source directory has the expected structure
    if [ ! -d "$SCRIPT_DIR/backend" ]; then
        echo "ERROR: backend directory not found in $SCRIPT_DIR"
        echo "This doesn't look like a poker-night git repository."
        echo "Contents of $SCRIPT_DIR:"
        ls -la "$SCRIPT_DIR"
        exit 1
    fi
    
    # Copy files (excluding git and temporary files)
    rsync -av \
        --exclude='.git' \
        --exclude='venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='*.log' \
        --exclude='poker_data' \
        "$SCRIPT_DIR/" "$APP_DIR/"
    
    echo "File copy completed. Verifying structure..."
    if [ -d "$APP_DIR/backend" ] && [ -f "$APP_DIR/backend/run.py" ]; then
        echo "✓ Application files copied successfully"
    else
        echo "✗ Copy failed - missing required files"
        exit 1
    fi
    
    # Set permissions ONLY on the app directory (never on git files)
    echo "Setting permissions on app directory only..."
    chmod +x "$APP_DIR/backend/run.py"
    chmod -R 755 "$APP_DIR"
    echo "Permissions set on $APP_DIR"
    
elif [ "$DEPLOYMENT_MODE" = "production" ]; then
    # Running from production directory - just verify structure and update dependencies
    echo "Verifying production app structure..."
    if [ ! -d "$SCRIPT_DIR/backend" ] || [ ! -f "$SCRIPT_DIR/backend/run.py" ]; then
        echo "ERROR: Invalid production app structure in $SCRIPT_DIR"
        echo "Missing backend directory or run.py file"
        exit 1
    fi
    
    # Ensure permissions are correct
    echo "Ensuring proper permissions..."
    chmod +x "$SCRIPT_DIR/backend/run.py"
    chmod -R 755 "$SCRIPT_DIR"
    echo "Permissions verified"
    
    # APP_DIR already set to SCRIPT_DIR above
fi

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
