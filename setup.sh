#!/bin/bash

echo "🚀 Setting up APK Builder Backend..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Check if AndroidRestrictedWebView exists
if [ ! -d "AndroidRestrictedWebView" ]; then
    echo "📥 Cloning AndroidRestrictedWebView template..."
    git clone https://github.com/lo-mityaesh/AndroidRestrictedWebView.git
else
    echo "✅ AndroidRestrictedWebView already exists"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p output
mkdir -p public

# Copy environment file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
fi

# Check for Java
if ! command -v java &> /dev/null; then
    echo "⚠️  Warning: Java is not installed. You'll need Java 11+ to build APKs."
    echo "   Install Java: https://adoptium.net/"
else
    echo "✅ Java found: $(java -version 2>&1 | head -n 1)"
fi

# Check for Android SDK
if [ -z "$ANDROID_SDK_ROOT" ] && [ -z "$ANDROID_HOME" ]; then
    echo "⚠️  Warning: ANDROID_SDK_ROOT or ANDROID_HOME not set."
    echo "   You'll need Android SDK to build APKs."
    echo "   Install Android Studio: https://developer.android.com/studio"
else
    echo "✅ Android SDK found"
fi

# Make gradlew executable
if [ -f "AndroidRestrictedWebView/gradlew" ]; then
    chmod +x AndroidRestrictedWebView/gradlew
    echo "✅ Made gradlew executable"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure .env file if needed"
echo "   2. Ensure Android SDK is installed and configured"
echo "   3. Run 'npm start' to start the server"
echo ""
echo "🌐 The server will be available at http://localhost:3000"
