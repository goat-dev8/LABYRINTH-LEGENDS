#!/bin/bash
# ============================================
# Labyrinth Legends - Test Linera Connection
# ============================================

set -e

echo "🔗 LABYRINTH LEGENDS - Testing Linera Connection"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration (from .env or defaults)
CHAIN_ID="${LINERA_CHAIN_ID:-5c2c15690694204e8bf3659c87990d2d44c61f857b304b5755d5debb6fc24b36}"
APP_ID="${LINERA_APP_ID:-14252ed65b362813ef5dc339f76f9db7a2cb775f61b8e78aed28f9e75407606a}"
GRAPHQL_ENDPOINT="${LINERA_GRAPHQL_ENDPOINT:-https://linera-graphql-eu.staketab.org}"

echo -e "${BLUE}Configuration:${NC}"
echo "   Chain ID:    $CHAIN_ID"
echo "   App ID:      $APP_ID"
echo "   GraphQL:     $GRAPHQL_ENDPOINT"
echo ""

# ============================================
# TEST 1: Check Linera CLI
# ============================================

echo -e "${BLUE}Test 1: Linera CLI${NC}"

if command -v linera &> /dev/null; then
    LINERA_VERSION=$(linera --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✅ Linera CLI installed: $LINERA_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Linera CLI not found${NC}"
fi
echo ""

# ============================================
# TEST 2: Check Wallet
# ============================================

echo -e "${BLUE}Test 2: Wallet Status${NC}"

if command -v linera &> /dev/null; then
    if linera wallet show &> /dev/null; then
        echo -e "${GREEN}✅ Wallet configured${NC}"
        
        # Show chain info
        echo ""
        echo "   Chains:"
        linera wallet show 2>/dev/null | grep -E "Chain|chain" | head -5 || true
    else
        echo -e "${YELLOW}⚠️  Wallet not initialized${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (no CLI)${NC}"
fi
echo ""

# ============================================
# TEST 3: GraphQL Endpoint
# ============================================

echo -e "${BLUE}Test 3: GraphQL Endpoint${NC}"

APP_ENDPOINT="$GRAPHQL_ENDPOINT/chains/$CHAIN_ID/applications/$APP_ID"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$APP_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d '{"query":"{ __typename }"}' 2>/dev/null || echo "000")

if [ "$RESPONSE" == "200" ]; then
    echo -e "${GREEN}✅ GraphQL endpoint reachable (HTTP 200)${NC}"
elif [ "$RESPONSE" == "000" ]; then
    echo -e "${RED}❌ Failed to connect to GraphQL endpoint${NC}"
else
    echo -e "${YELLOW}⚠️  GraphQL returned HTTP $RESPONSE${NC}"
fi
echo ""

# ============================================
# TEST 4: Query Application Stats
# ============================================

echo -e "${BLUE}Test 4: Application Stats${NC}"

STATS_QUERY='{"query":"{ stats { totalPlayers totalTournaments totalRuns activeTournaments } }"}'

STATS_RESPONSE=$(curl -s -X POST "$APP_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "$STATS_QUERY" 2>/dev/null || echo '{"errors":[{"message":"Connection failed"}]}')

if echo "$STATS_RESPONSE" | grep -q '"data"'; then
    echo -e "${GREEN}✅ Application responding${NC}"
    echo ""
    echo "   Stats:"
    echo "$STATS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin).get('data',{}).get('stats',{}); print(f\"   Total Players: {d.get('totalPlayers', 'N/A')}\"); print(f\"   Total Tournaments: {d.get('totalTournaments', 'N/A')}\"); print(f\"   Total Runs: {d.get('totalRuns', 'N/A')}\"); print(f\"   Active Tournaments: {d.get('activeTournaments', 'N/A')}\")" 2>/dev/null || echo "   (Could not parse response)"
elif echo "$STATS_RESPONSE" | grep -q '"errors"'; then
    echo -e "${YELLOW}⚠️  Application returned an error${NC}"
    echo "$STATS_RESPONSE" | python3 -c "import sys,json; e=json.load(sys.stdin).get('errors',[{}])[0]; print(f\"   Error: {e.get('message', 'Unknown')}\")" 2>/dev/null || echo "   (Could not parse error)"
else
    echo -e "${RED}❌ No valid response from application${NC}"
fi
echo ""

# ============================================
# SUMMARY
# ============================================

echo "=================================================="
echo -e "${GREEN}Testing complete!${NC}"
echo ""
echo "Application GraphQL Endpoint:"
echo "  $APP_ENDPOINT"
echo ""
