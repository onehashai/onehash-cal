#!/bin/bash

# Usage: ./connect-rds.sh -calp|-cals|-chatp|-chats

set -e

ENV_FILE=".env"

# Validate flag and set required keys
case "$1" in
  -calp )
    REQUIRED_KEYS=(CALPROD_EC2_DNS CALPROD_RDS_ENDPOINT CALPROD_PEM_PATH)
    ;;
  -cals )
    REQUIRED_KEYS=(CALSTAGING_EC2_DNS CALSTAGING_RDS_ENDPOINT CALSTAGING_PEM_PATH)
    ;;
  -chatp )
    REQUIRED_KEYS=(CHATPROD_EC2_DNS CHATPROD_RDS_ENDPOINT CHATPROD_PEM_PATH)
    ;;
  -chats )
    REQUIRED_KEYS=(CHATSTAGING_EC2_DNS CHATSTAGING_RDS_ENDPOINT CHATSTAGING_PEM_PATH)
    ;;
  * )
    echo "Usage: $0 [-calp|-cals|-chatp|-chats]"
    exit 1
    ;;
esac

# Check that each required key exists in the .env file
MISSING_KEYS=()

for KEY in "${REQUIRED_KEYS[@]}"; do
  if ! grep -q "^$KEY=" "$ENV_FILE"; then
    MISSING_KEYS+=("$KEY")
  fi
done

if [ ${#MISSING_KEYS[@]} -ne 0 ]; then
  echo "❌ Missing keys in $ENV_FILE:"
  for KEY in "${MISSING_KEYS[@]}"; do
    echo "  - $KEY"
  done
  exit 1
fi

# Export only the required keys from .env
eval $(grep -E "^($(IFS='|'; echo "${REQUIRED_KEYS[*]}"))=" "$ENV_FILE")

# Map env variables to script variables
case "$1" in
  -calp )
    RDS_ENDPOINT=$CALPROD_RDS_ENDPOINT
    EC2_DNS=$CALPROD_EC2_DNS
    PEM_KEY=$CALPROD_PEM_PATH
    ;;
  -cals )
    RDS_ENDPOINT=$CALSTAGING_RDS_ENDPOINT
    EC2_DNS=$CALSTAGING_EC2_DNS
    PEM_KEY=$CALSTAGING_PEM_PATH
    ;;
  -chatp )
    RDS_ENDPOINT=$CHATPROD_RDS_ENDPOINT
    EC2_DNS=$CHATPROD_EC2_DNS
    PEM_KEY=$CHATPROD_PEM_PATH
    ;;
  -chats )
    RDS_ENDPOINT=$CHATSTAGING_RDS_ENDPOINT
    EC2_DNS=$CHATSTAGING_EC2_DNS
    PEM_KEY=$CHATSTAGING_PEM_PATH
    ;;
esac

# Validation
if [[ -z "$RDS_ENDPOINT" || -z "$EC2_DNS" || -z "$PEM_KEY" ]]; then
  echo "❌ Missing config values after loading .env"
  exit 1
fi

if [ ! -f "$PEM_KEY" ]; then
  echo "❌ PEM file not found: $PEM_KEY"
  exit 1
fi

# Ensure permissions are correct
chmod 400 "$PEM_KEY"

PORT_LOCAL=5433

echo "🔐 Connecting to $RDS_ENDPOINT via $EC2_DNS"
echo "🛡️ Using key: $PEM_KEY"
echo "🌐 Tunnel will be open on localhost:$PORT_LOCAL"

# Start the SSH tunnel
ssh -i "$PEM_KEY" -L "$PORT_LOCAL:$RDS_ENDPOINT:5432" "$EC2_DNS"
