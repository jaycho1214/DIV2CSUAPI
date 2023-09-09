#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if the DATABASE_URL environment variable exists
if [[ -z "${DATABASE_URL}" ]]; then
  echo "DATABASE_URL environment variable is not set."
else
  yarn kysely-codegen
fi