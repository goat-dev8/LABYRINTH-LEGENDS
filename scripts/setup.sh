#!/bin/bash
# Labyrinth Legends - Development Setup Script

set -e

echo "🎮 Setting up Labyrinth Legends development environment"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi

PNPM_VERSION=$(pnpm --version)
echo "✅ pnpm version: $PNPM_VERSION"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Create .env files if not exist
echo ""
echo "📝 Setting up environment files..."

if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo "   Created backend/.env"
fi

if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    echo "   Created frontend/.env"
fi

# Build game engine
echo ""
echo "🎮 Building game engine..."
cd game-engine
pnpm build 2>/dev/null || echo "   (No build step defined, using source directly)"
cd ..

# Check Rust/Linera (optional)
echo ""
if command -v cargo &> /dev/null; then
    echo "✅ Rust is installed"
    
    if command -v linera &> /dev/null; then
        LINERA_VERSION=$(linera --version 2>/dev/null || echo "unknown")
        echo "✅ Linera CLI: $LINERA_VERSION"
    else
        echo "⚠️  Linera CLI not found. To deploy contracts, install with:"
        echo "   cargo install linera-sdk@0.15.8"
    fi
else
    echo "⚠️  Rust not installed. Smart contract deployment requires Rust."
    echo "   Install from: https://rustup.rs/"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ SETUP COMPLETE!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "To start development:"
echo ""
echo "  1. Start backend:  cd backend && pnpm dev"
echo "  2. Start frontend: cd frontend && pnpm dev"
echo ""
echo "Or run both with: pnpm dev"
echo ""
echo "Frontend will be at: http://localhost:5173"
echo "Backend will be at:  http://localhost:3001"
echo ""
