#!/bin/bash
# ============================================
# Labyrinth Legends - Start Development Servers
# ============================================

set -e

echo "🎮 LABYRINTH LEGENDS - Starting Development Servers"
echo "===================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================
# DISPLAY CONFIGURATION
# ============================================

echo -e "${BLUE}⚙️  Configuration:${NC}"
echo ""

if [ -f "frontend/.env" ]; then
    CHAIN_ID=$(grep VITE_LINERA_CHAIN_ID frontend/.env | cut -d '=' -f2)
    APP_ID=$(grep VITE_LINERA_APP_ID frontend/.env | cut -d '=' -f2)
    API_URL=$(grep VITE_API_URL frontend/.env | cut -d '=' -f2)
    
    echo "   Chain ID:    ${CHAIN_ID:0:16}..."
    echo "   App ID:      ${APP_ID:0:16}..."
    echo "   Backend URL: ${API_URL:-http://localhost:3001}"
fi

echo ""
echo "===================================================="
echo ""

# ============================================
# START SERVICES
# ============================================

echo -e "${YELLOW}Starting backend server on port 3001...${NC}"
echo -e "${YELLOW}Starting frontend server on port 5173...${NC}"
echo ""

# Use pnpm to run both in parallel
pnpm run dev

