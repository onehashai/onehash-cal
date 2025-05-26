#!/bin/bash

# Usage: ./connect-rds.sh -p|-s

set -e


ROOT_DIR=/Users/apple/Documents/OneHash/ec2/

# 🔹CAL  STAGING CONFIG
CALSTAGING_EC2_DNS=ubuntu@ec2-3-7-112-146.ap-south-1.compute.amazonaws.com
CALSTAGING_RDS_ENDPOINT=postgres-db.ch8bjhtexpql.ap-south-1.rds.amazonaws.com
CALSTAGING_PEM_PATH="$ROOT_DIR/cal_stag.pem"

# 🔸CAL PRODUCTION CONFIG
CALPROD_EC2_DNS=ubuntu@ec2-15-206-99-88.ap-south-1.compute.amazonaws.com
CALPROD_RDS_ENDPOINT=postgres-db.ch8bjhtexpql.ap-south-1.rds.amazonaws.com
CALPROD_PEM_PATH="$ROOT_DIR/cal_prod.pem"

# 🔹 CHAT STAGING CONFIG
CHATSTAGING_EC2_DNS=ubuntu@ec2-13-127-187-131.ap-south-1.compute.amazonaws.com
CHATSTAGING_RDS_ENDPOINT=postgres-db.ch8bjhtexpql.ap-south-1.rds.amazonaws.com
CHATSTAGING_PEM_PATH="$ROOT_DIR/chat_stag.pem"

# 🔸 CHAT PRODUCTION CONFIG
CHATPROD_EC2_DNS=ubuntu@ec2-13-127-190-229.ap-south-1.compute.amazonaws.com
CHATPROD_RDS_ENDPOINT=postgres-db.ch8bjhtexpql.ap-south-1.rds.amazonaws.com
CHATPROD_PEM_PATH="$ROOT_DIR/chat_prod.pem"



# Defaults
PORT_LOCAL=5433
RDS_ENDPOINT=""
EC2_DNS=""
PEM_KEY=""

# Parse single argument
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
  * )
    echo "Usage: $0 [-calp|-cals|-chatp|-chats]"
    exit 1
    ;;
esac

# Validate
if [[ -z "$RDS_ENDPOINT" || -z "$EC2_DNS" || -z "$PEM_KEY" ]]; then
  echo "❌ Missing config."
  exit 1
fi

if [ ! -f "$PEM_KEY" ]; then
  echo "❌ PEM file not found: $PEM_KEY"
  exit 1
fi

# Ensure permissions are correct
chmod 400 "$PEM_KEY"

echo "🔐 Connecting to $RDS_ENDPOINT via $EC2_DNS"
echo "🛡️ Using key: $PEM_KEY"
echo "🌐 Tunnel will be open on localhost:$PORT_LOCAL"

# Start the SSH tunnel
ssh -i "$PEM_KEY" -L "$PORT_LOCAL:$RDS_ENDPOINT:5432" "$EC2_DNS"
