#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 ICE Activity Map - Deployment Initialization${NC}"
echo "================================================"

# Check prerequisites
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ $1 is installed${NC}"
}

# Find flyctl
if command -v $FLY &> /dev/null; then
    FLY="fly"
elif command -v flyctl &> /dev/null; then
    FLY="flyctl"
elif [ -f "$HOME/.fly/bin/flyctl" ]; then
    FLY="$HOME/.fly/bin/flyctl"
else
    echo -e "${RED}❌ fly/flyctl is not installed. Please install it first.${NC}"
    echo "Run: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

echo -e "\n${YELLOW}Checking prerequisites...${NC}"
echo -e "${GREEN}✓ $FLY is installed ($FLY)${NC}"
check_command node
check_command npm

# Check if logged in to Fly.io
if ! $FLY auth whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Fly.io:${NC}"
    $FLY auth login
fi
echo -e "${GREEN}✓ Logged in to Fly.io as $($FLY auth whoami)${NC}"

# Prompt for configuration
echo -e "\n${YELLOW}Configuration${NC}"
echo "============="

read -p "Enter your domain (e.g., ice-map.example.com) [ice-activity-map]: " DOMAIN
DOMAIN=${DOMAIN:-ice-activity-map}

read -p "Enter Fly.io region (sjc, iad, lhr, etc.) [sjc]: " REGION
REGION=${REGION:-sjc}

read -p "Enter Bluesky handle (e.g., user.bsky.social): " BLUESKY_HANDLE
read -sp "Enter Bluesky app password: " BLUESKY_PASSWORD
echo ""

read -p "Enter Turnstile site key (or press enter to skip): " TURNSTILE_SITE_KEY
read -sp "Enter Turnstile secret key (or press enter to skip): " TURNSTILE_SECRET_KEY
echo ""

# Generate admin API key
ADMIN_API_KEY=$(openssl rand -hex 32)
echo -e "\n${GREEN}Generated Admin API Key: ${ADMIN_API_KEY}${NC}"
echo -e "${YELLOW}Save this key securely - you'll need it for admin operations!${NC}"

# Create database
echo -e "\n${YELLOW}Step 1: Creating PostgreSQL database...${NC}"
$FLY postgres create \
    --name "${DOMAIN}-db" \
    --region "$REGION" \
    --initial-cluster-size 1 \
    --vm-size shared-cpu-1x \
    --volume-size 1 \
    || echo "Database may already exist, continuing..."

# Create API app
echo -e "\n${YELLOW}Step 2: Creating API app...${NC}"
$FLY apps create "${DOMAIN}-api" --org personal || echo "App may already exist, continuing..."

# Attach database to API
echo -e "\n${YELLOW}Step 3: Attaching database to API...${NC}"
$FLY postgres attach "${DOMAIN}-db" --app "${DOMAIN}-api" || echo "Already attached, continuing..."

# Set API secrets
echo -e "\n${YELLOW}Step 4: Setting API secrets...${NC}"
$FLY secrets set \
    CORS_ORIGIN="https://${DOMAIN}.vercel.app" \
    ADMIN_API_KEY="$ADMIN_API_KEY" \
    ${TURNSTILE_SECRET_KEY:+TURNSTILE_SECRET_KEY="$TURNSTILE_SECRET_KEY"} \
    --app "${DOMAIN}-api"

# Deploy API
echo -e "\n${YELLOW}Step 5: Deploying API...${NC}"
$FLY deploy --config fly.toml --app "${DOMAIN}-api" --remote-only

# Create ingestion app
echo -e "\n${YELLOW}Step 6: Creating Ingestion app...${NC}"
$FLY apps create "${DOMAIN}-ingestion" --org personal || echo "App may already exist, continuing..."

# Attach database to ingestion
echo -e "\n${YELLOW}Step 7: Attaching database to Ingestion...${NC}"
$FLY postgres attach "${DOMAIN}-db" --app "${DOMAIN}-ingestion" || echo "Already attached, continuing..."

# Set ingestion secrets
echo -e "\n${YELLOW}Step 8: Setting Ingestion secrets...${NC}"
$FLY secrets set \
    BLUESKY_IDENTIFIER="$BLUESKY_HANDLE" \
    BLUESKY_APP_PASSWORD="$BLUESKY_PASSWORD" \
    NOMINATIM_USER_AGENT="ICEActivityMap/1.0" \
    --app "${DOMAIN}-ingestion"

# Deploy ingestion
echo -e "\n${YELLOW}Step 9: Deploying Ingestion...${NC}"
$FLY deploy --config apps/ingestion/fly.toml --app "${DOMAIN}-ingestion" --remote-only

# Run migrations
echo -e "\n${YELLOW}Step 10: Running database migrations...${NC}"
DATABASE_URL=$($FLY postgres connect --app "${DOMAIN}-db" -d postgres -c "SELECT 1" 2>&1 | head -1 || true)

# Get the actual connection string
FLY_DB_URL=$($FLY ssh console --app "${DOMAIN}-api" -C "printenv DATABASE_URL" 2>/dev/null || true)

if [ -n "$FLY_DB_URL" ]; then
    echo "Running migrations via API container..."
    $FLY ssh console --app "${DOMAIN}-api" -C "node -e \"require('./packages/database/dist/schema/migrate.js').migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })\""
else
    echo -e "${YELLOW}Please run migrations manually:${NC}"
    echo "fly ssh console --app ${DOMAIN}-api"
    echo "Then run: node -e \"require('./packages/database/dist/schema/migrate.js').migrate()\""
fi

# Print summary
echo -e "\n${GREEN}✅ Deployment Complete!${NC}"
echo "========================"
echo ""
echo -e "API URL:        ${GREEN}https://${DOMAIN}-api.fly.dev${NC}"
echo -e "API Health:     ${GREEN}https://${DOMAIN}-api.fly.dev/health${NC}"
echo -e "API Docs:       ${GREEN}https://${DOMAIN}-api.fly.dev/api-docs${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Deploy the web app to Vercel:"
echo "   cd apps/web && vercel --prod"
echo ""
echo "2. Set Vercel environment variables:"
echo "   VITE_API_URL=https://${DOMAIN}-api.fly.dev"
echo "   VITE_WS_URL=wss://${DOMAIN}-api.fly.dev"
if [ -n "$TURNSTILE_SITE_KEY" ]; then
    echo "   VITE_TURNSTILE_SITE_KEY=$TURNSTILE_SITE_KEY"
fi
echo ""
echo "3. Update CORS_ORIGIN after Vercel deployment:"
echo "   $FLY secrets set CORS_ORIGIN=https://your-vercel-url.vercel.app --app ${DOMAIN}-api"
echo ""
echo -e "${YELLOW}Admin API Key (save this!):${NC}"
echo "$ADMIN_API_KEY"
