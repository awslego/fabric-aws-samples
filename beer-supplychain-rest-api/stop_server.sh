#!/bin/sh
echo "Stop app server"
./node_modules/pm2/bin/pm2 stop beer-supplychain
