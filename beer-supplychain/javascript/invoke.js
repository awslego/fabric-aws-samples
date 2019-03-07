/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { FileSystemWallet, Gateway } = require('fabric-network');
const fs = require('fs');
const path = require('path');

const ccpPath = path.resolve(__dirname, '..', '..', 'basic-network', 'connection.json');
const ccpJSON = fs.readFileSync(ccpPath, 'utf8');
const ccp = JSON.parse(ccpJSON);

async function main(n) {
    try {

        // Create a new file system based wallet for managing identities.
        const walletPath = path.join(process.cwd(), 'wallet');
        const wallet = new FileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the user.
        const userExists = await wallet.exists('user1');
        if (!userExists) {
            console.log('An identity for the user "user1" does not exist in the wallet');
            console.log('Run the registerUser.js application before retrying');
            return;
        }

        // Create a new gateway for connecting to our peer node.
        const gateway = new Gateway();
        await gateway.connect(ccp, { wallet, identity: 'user1', discovery: { enabled: false } });

        // Get the network (channel) our contract is deployed to.
        const network = await gateway.getNetwork('mychannel');

        // Get the contract from the network.
        const contract = network.getContract('beer-supplychain');

        // Submit the specified transaction.

        ////await contract.submitTransaction('createOrder', "ORDER7", '1', 'D', 'Tom');
        ////await contract.submitTransaction('changeOrder', 'ORDER0', 'Owner', 'Dave')
        ////await contract.submitTransaction('changeOrder', 'ORDER0', 'State', '0')
        ////await contract.submitTransaction('changeOrder', 'ORDER0', 'Count', '100')

        switch( n ) {
            case '0':    // 0. Init
                await contract.submitTransaction('initLedger');
                break;
            case '1':    // 1. Device
                await contract.submitTransaction('startTransfer', 'Manufacturer', '5');
                break;
            case '2':    // 2. Manufacturer
                await contract.submitTransaction('acceptTransfer');
                await contract.submitTransaction('requestTransfer','Distributor', '5');
                break;
            case '3':    // 3. Truck
                await contract.submitTransaction('acceptTransfer');
                await contract.submitTransaction('requestTransfer', 'BeerHouse', '4');
                break;
            case '4':    // 4. Shop
                await contract.submitTransaction('acceptTransfer');
                await contract.submitTransaction('Complete');

                // add the order history
                //await contract.submitTransaction('createOrder', 'ORDER0', '', '', '');

                break;
            default:
                console.log('Incorrect input %s\n', n);
        }

        console.log('Transaction has been submitted\n');


        const result = await contract.evaluateTransaction('queryAllOrder');
        console.log(`Transaction has been evaluated, result is: ${result.toString()}\n`);

        // Disconnect from the gateway.
        await gateway.disconnect();

    } catch (error) {
        console.error(`Failed to submit transaction: ${error}`);
        process.exit(1);
    }
}

main(process.argv[2]);
