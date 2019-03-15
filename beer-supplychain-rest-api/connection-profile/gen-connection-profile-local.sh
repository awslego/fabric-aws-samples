#!/bin/bash

# Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# A copy of the License is located at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# or in the "license" file accompanying this file. This file is distributed 
# on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
# express or implied. See the License for the specific language governing 
# permissions and limitations under the License.

# This script uses the template ngo-connection-profile.json to generate a connection profile
# for the organisations in the Fabric network.

#REPODIR points to this repo.
REPODIR=~/fabric-aws-samples

#CERTDIR points to the location of the fabric-samples repo. If you are using this to run Fabric, the crypto information
#would have been generated in the first-network/crypto-config folder.
CERTDIR=~/fabric-samples

#copy the connection profiles
mkdir -p $REPODIR/tmp/connection-profile/org1
mkdir -p $REPODIR/tmp/connection-profile/org2
cp beer-supplychain-connection-profile.yaml $REPODIR/tmp/connection-profile
cp client-org1.yaml $REPODIR/tmp/connection-profile/org1
cp client-org2.yaml $REPODIR/tmp/connection-profile/org2

#update the connection profiles to refer to the location of the Fabric crypto information
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -e "s|%REPODIR%|$CERTDIR|g" beer-supplychain-connection-profile.yaml > $REPODIR/tmp/connection-profile/beer-supplychain-connection-profile.yaml
else
    sed -i "s|%REPODIR%|$CERTDIR|g"  $REPODIR/tmp/connection-profile/beer-supplychain-connection-profile.yaml
fi 

ls -lR $REPODIR/tmp/connection-profile
