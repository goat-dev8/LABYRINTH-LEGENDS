#!/bin/bash
# Labyrinth Legends - Contract Deployment Script

set -e

echo "🚀 Deploying Labyrinth Legends Smart Contract to Linera Conway Testnet"
echo ""

# Check if Linera CLI is installed
if ! command -v linera &> /dev/null; then
    echo "❌ Linera CLI not found. Please install it first:"
    echo "   cargo install linera-sdk@0.15.8"
    exit 1
fi

# Check Linera version
LINERA_VERSION=$(linera --version 2>/dev/null || echo "unknown")
echo "📦 Linera version: $LINERA_VERSION"
echo ""

# Set up wallet if not exists
WALLET_FILE="$HOME/.linera/wallet.json"
if [ ! -f "$WALLET_FILE" ]; then
    echo "📝 Creating new wallet..."
    linera wallet init --faucet https://faucet.testnet-conway.linera.net
    echo ""
fi

# Get chain info
echo "🔗 Getting chain information..."
linera wallet show

# Navigate to contracts directory
cd "$(dirname "$0")/../contracts/labyrinth_tournament"

# Build the contract
echo ""
echo "🔨 Building contract..."
cargo build --release --target wasm32-unknown-unknown

# Get the bytecode location
BYTECODE_DIR="../../target/wasm32-unknown-unknown/release"
CONTRACT_WASM="$BYTECODE_DIR/labyrinth_tournament.wasm"
SERVICE_WASM="$BYTECODE_DIR/labyrinth_tournament_{service,contract}.wasm"

if [ ! -f "$CONTRACT_WASM" ]; then
    echo "⚠️  Contract WASM not found at expected location"
    echo "   Looking in: $CONTRACT_WASM"
    
    # Try alternate location
    ALT_LOCATION="$BYTECODE_DIR/labyrinth_tournament_contract.wasm"
    if [ -f "$ALT_LOCATION" ]; then
        CONTRACT_WASM="$ALT_LOCATION"
        echo "   Found at: $ALT_LOCATION"
    else
        echo "❌ Could not find compiled contract"
        exit 1
    fi
fi

# Publish bytecode
echo ""
echo "📤 Publishing bytecode..."
BYTECODE_ID=$(linera publish-bytecode "$CONTRACT_WASM" "$BYTECODE_DIR/labyrinth_tournament_service.wasm" 2>&1 | grep -oP '(?<=Bytecode ID: )[a-f0-9]+' || echo "")

if [ -z "$BYTECODE_ID" ]; then
    echo "⚠️  Could not extract bytecode ID, trying alternate method..."
    linera publish-bytecode "$CONTRACT_WASM" "$BYTECODE_DIR/labyrinth_tournament_service.wasm"
    echo ""
    echo "Please enter the Bytecode ID from above:"
    read BYTECODE_ID
fi

echo "✅ Bytecode ID: $BYTECODE_ID"

# Create application
echo ""
echo "📱 Creating application..."
APP_ID=$(linera create-application "$BYTECODE_ID" 2>&1 | grep -oP '(?<=Application ID: )[a-f0-9]+' || echo "")

if [ -z "$APP_ID" ]; then
    echo "⚠️  Could not extract application ID, trying alternate method..."
    linera create-application "$BYTECODE_ID"
    echo ""
    echo "Please enter the Application ID from above:"
    read APP_ID
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📦 Bytecode ID:    $BYTECODE_ID"
echo "📱 Application ID: $APP_ID"
echo ""
echo "🔗 GraphQL Endpoint: https://linera-graphql-eu.staketab.org"
echo ""
echo "Next steps:"
echo "1. Save these IDs in your .env files"
echo "2. Update frontend/src/lib/linera.ts with the Application ID"
echo "3. Test the contract using linera service"
echo ""
echo "To interact with the contract:"
echo "  linera service --port 8080"
echo "  # Then open http://localhost:8080 for GraphQL playground"
echo ""
