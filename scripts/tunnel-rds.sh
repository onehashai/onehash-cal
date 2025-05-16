#!/bin/bash

# Usage: ./connect-rds.sh -p|-s

set -e


# 🔹 STAGING CONFIG
STAGING_EC2_DNS=ubuntu@ec2-3-7-112-146.ap-south-1.compute.amazonaws.com
STAGING_RDS_ENDPOINT=postgres-db.ch8bjhtexpql.ap-south-1.rds.amazonaws.com
STAGING_PEM_PATH=/Users/apple/Documents/OneHash/ec2/cal_stag.pem

# 🔸 PRODUCTION CONFIG
PROD_EC2_DNS=ubuntu@ec2-15-206-99-88.ap-south-1.compute.amazonaws.com
PROD_RDS_ENDPOINT=postgres-db.ch8bjhtexpql.ap-south-1.rds.amazonaws.com
PROD_PEM_PATH=/Users/apple/Documents/OneHash/ec2/cal_prod.pem

# Defaults
PORT_LOCAL=5433
RDS_ENDPOINT=""
EC2_DNS=""
PEM_KEY=""

# Parse flags
while getopts ":ps" opt; do
  case ${opt} in
    p )
      RDS_ENDPOINT=$PROD_RDS_ENDPOINT
      EC2_DNS=$PROD_EC2_DNS
      PEM_KEY=$PROD_PEM_PATH
      ;;
    s )
      RDS_ENDPOINT=$STAGING_RDS_ENDPOINT
      EC2_DNS=$STAGING_EC2_DNS
      PEM_KEY=$STAGING_PEM_PATH
      ;;
    \? )
      echo "Usage: $0 [-p|-s]"
      exit 1
      ;;
  esac
done

if [[ -z "$RDS_ENDPOINT" || -z "$EC2_DNS" || -z "$PEM_KEY" ]]; then
  echo "❌ Missing config. Make sure you pass -p or -s ."
  exit 1
fi

# Ensure permissions are correct
chmod 400 "$PEM_KEY"

echo "🔐 Connecting to $RDS_ENDPOINT via $EC2_DNS"
echo "🛡️ Using key: $PEM_KEY"
echo "🌐 Tunnel will be open on localhost:$PORT_LOCAL"

# Start the SSH tunnel
ssh -i "$PEM_KEY" -L "$PORT_LOCAL:$RDS_ENDPOINT:5432" "$EC2_DNS"
