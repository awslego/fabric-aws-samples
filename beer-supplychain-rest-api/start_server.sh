#!/bin/sh
echo "Start app server"
./node_modules/pm2/bin/pm2 start app.js --name "beer-supplychain"
