/*
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
#
*/
'use strict';
var log4js = require('log4js');
log4js.configure({
  appenders: {
    out: { type: 'stdout' },
  },
  categories: {
    default: { appenders: ['out'], level: 'info' },
  }
});
var logger = log4js.getLogger('BEER-API');
const WebSocketServer = require('ws');
var express = require('express');
var bodyParser = require('body-parser');
var http = require('http');
var util = require('util');
var app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc')
const options = {
  definition: {
    openapi: '3.0.0', // Specification (optional, defaults to swagger: '2.0')
    info: {
      title: 'Beer Supplychain API', // Title (required)
      version: '1.0.0', // Version (required)
    },
  },
  // Path to the API docs
  apis: ['./app.js'],
};
const swaggerSpec = swaggerJSDoc(options);

var cors = require('cors');
var hfc = require('fabric-client');
const uuidv4 = require('uuid/v4');

var connection = require('./connection.js');
var query = require('./query.js');
var invoke = require('./invoke.js');
var blockListener = require('./blocklistener.js');

hfc.addConfigFile('config.json');
var host = '0.0.0.0';
var port = 3000;
var channelName = hfc.getConfigSetting('channelName');
var chaincodeName = hfc.getConfigSetting('chaincodeName');
var peers = hfc.getConfigSetting('peers');
///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// SET CONFIGURATONS ////////////////////////////
///////////////////////////////////////////////////////////////////////////////
app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(function(req, res, next) {
	logger.info(' ##### New request for URL %s',req.originalUrl);
	return next();
});

//wrapper to handle errors thrown by async functions. We can catch all
//errors thrown by async functions in a single place, here in this function,
//rather than having a try-catch in every function below. The 'next' statement
//used here will invoke the error handler function - see the end of this script
const awaitHandler = (fn) => {
	return async (req, res, next) => {
		try {
			await fn(req, res, next)
		} 
		catch (err) {
			next(err)
		}
	}
}

app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START SERVER /////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
var server = http.createServer(app).listen(port, function() {});
logger.info('****************** SERVER STARTED ************************');
logger.info('***************  Listening on: http://%s:%s  ******************',host,port);
server.timeout = 240000;

function getErrorMessage(field) {
	var response = {
		success: false,
		message: field + ' field is missing or Invalid in the request'
	};
	return response;
}

///////////////////////////////////////////////////////////////////////////////
//////////////////////////////// START WEBSOCKET SERVER ///////////////////////
///////////////////////////////////////////////////////////////////////////////
const wss = new WebSocketServer.Server({ server });
wss.on('connection', function connection(ws) {
	logger.info('****************** WEBSOCKET SERVER - received connection ************************');
	ws.on('message', function incoming(message) {
		console.log('##### Websocket Server received message: %s', message);
	});

	ws.send('something');
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////// REST ENDPOINTS START HERE ///////////////////////////
///////////////////////////////////////////////////////////////////////////////


/**
 * @swagger
 *
 * /users:
 *   post:
 *     summary: Register and enroll user.
 *     tags:
 *       - User
 *     description: A user must be registered and enrolled before any queries or transactions can be invoked
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               orgName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/users', awaitHandler(async (req, res) => {
	logger.info('================ POST on Users');
	let username = req.body.username;
	let orgName = req.body.orgName;
	logger.info('##### End point : /users');
	logger.info('##### POST on Users - username : ' + username);
	logger.info('##### POST on Users - userorg  : ' + orgName);
	let response = await connection.getRegisteredUser(username, orgName, true);
	logger.info('##### POST on Users - returned from registering the username %s for organization %s', username, orgName);
	logger.info('##### POST on Users - getRegisteredUser response secret %s', response.secret);
	logger.info('##### POST on Users - getRegisteredUser response secret %s', response.message);
    if (response && typeof response !== 'string') {
        logger.info('##### POST on Users - Successfully registered the username %s for organization %s', username, orgName);
		logger.info('##### POST on Users - getRegisteredUser response %s', response);
		// Now that we have a username & org, we can start the block listener
		await blockListener.startBlockListener(channelName, username, orgName, wss);
		res.json(response);
	} else {
		logger.error('##### POST on Users - Failed to register the username %s for organization %s with::%s', username, orgName, response);
		res.json({success: false, message: response});
	}
}));

/************************************************************************************
 * Beer SupplyChain methods
 ************************************************************************************/
/**
 * @swagger
 *
 * /orders:
 *   get:
 *     summary: List of all orders
 *     tags:
 *       - Order
 *     description: Returns a list of all orders 
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: list of orders
 */
app.get('/orders', awaitHandler(async (req, res) => {
	logger.info('================ GET All Orders');
	let args = [];
	let fcn = "queryAllOrder";

	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

	logger.info('##### GET on Orders - username : ' + username);
	logger.info('##### GET on Orders - userOrg : ' + orgName);
	logger.info('##### GET on Orders - channelName : ' + channelName);
	logger.info('##### GET on Orders - chaincodeName : ' + chaincodeName);
	logger.info('##### GET on Orders - fcn : ' + fcn);
	logger.info('##### GET on Orders - args : ' + args.toString());
	logger.info('##### GET on Orders - peers : ' + peers);

    let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

/**
 * @swagger
 *
 * /orders/{key}:
 *   get:
 *     summary: Find order by KEY 
 *     tags:
 *     - Order
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: key
 *       in: path
 *       required: true
 *       description: Get a specific order by KEY
 *       schema:
 *         type: string
 *     responses:
 *       200:
 *         description: order information
 */
app.get('/orders/:Key', awaitHandler(async (req, res) => {
	logger.info('================ GET on Order by Key');
	logger.info('Key : ' + req.params.Key);
	let args = [req.params.Key];
	let fcn = "queryOrder";

	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

	let message = await query.queryChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
 	res.send(message);
}));

/**
 * @swagger
 *
 * /orders/{key}:
 *   put:
 *     summary: Change order by KEY
 *     tags:
 *       - Order
 *     description: Change order information
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: key
 *       in: path
 *       required: true
 *       description: Change a specific order by KEY
 *       schema:
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               State:
 *                 type: string
 *               Count:
 *                 type: string
 *               Owner:
 *                 type: string
 *     responses:
 *       200:
 *         description: Execution result
 */
app.put('/orders/:Key', awaitHandler(async (req, res) => {
	logger.info('================ PUT on Order');
	var body = req.body;
	var fcn = "changeOrder";
	logger.info(body);
	var args = [];
	args.push(req.params.Key)
	args.push(body["State"]);
	args.push(body["Count"]);
	args.push(body["Owner"]);
	
	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));


/**
 * @swagger
 *
 * /orders:
 *   post:
 *     summary: Create a new order
 *     tags:
 *       - Order
 *     description: Create a new beer purchase order
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Key:
 *                 type: string
 *               State:
 *                 type: string
 *               Count:
 *                 type: string
 *               Owner:
 *                 type: string
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/orders', awaitHandler(async (req, res) => {
    logger.info('================ POST on Order');
    var body = req.body;
    var fcn = "createOrder";
	logger.info(body);
	var args = [];
	args.push(body["Key"])
	args.push(body["State"]);
	args.push(body["Count"]);
	args.push(body["Owner"]);
	
	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

    let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
    res.send(message);
}));

/**
 * @swagger
 *
 * /transfer/init:
 *   post:
 *     summary: Init a ledger 
 *     tags:
 *       - Transfer
 *     description: Create a new beer purchase order
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/transfer/init', awaitHandler(async (req, res) => {
    logger.info('================ POST on Tranfer Init');
    var fcn = "initLedger";
	var args = [];

	let username = req.header("X-username");
    let orgName = req.header("X-orgName");

    let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
    res.send(message);
}));

/**
 * @swagger
 *
 * /transfer/start:
 *   post:
 *     summary: Start a transfer
 *     tags:
 *       - Transfer
 *     description: Create a new beer purchase order
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Owner:
 *                 type: string
 *               Count:
 *                 type: string
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/transfer/start', awaitHandler(async (req, res) => {
	logger.info('================ POST on Transfer Start');
    var body = req.body;
    var fcn = "startTransfer";
	logger.info(body);
	var args = [];
	args.push(body["Owner"]);
	args.push(body["Count"]);
	let username = req.header("X-username");
    let orgName = req.header("X-orgName");

    let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
    res.send(message);
}));

/**
 * @swagger
 *
 * /transfer/request:
 *   post:
 *     summary: Request a transfer
 *     tags:
 *       - Transfer
 *     description: Send a transfer request
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               Owner:
 *                 type: string
 *               Count:
 *                 type: string
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/transfer/request', awaitHandler(async (req, res) => {
	logger.info('================ POST on Transfer Request');
	var body = req.body;
	var fcn = "requestTransfer";
	logger.info(body);
	var args = [];
	args.push(body["Owner"]);
	args.push(body["Count"]);
	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));

/**
 * @swagger
 *
 * /transfer/accept:
 *   post:
 *     summary: Accept a tranfer
 *     tags:
 *       - Transfer
 *     description: Send an accept request
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/transfer/accept', awaitHandler(async (req, res) => {
	logger.info('================ POST on Tranfer Accept');
	var fcn = "acceptTransfer";
	var args = [];

	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));

/**
 * @swagger
 *
 * /transfer/complete:
 *   post:
 *     summary: Complete a tranfer
 *     tags:
 *       - Transfer
 *     description: Complete..
 *     parameters:
 *     - name: X-username
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     - name: X-orgName
 *       in: header
 *       required: true
 *       schema:
 *         type: string
 *     requestBody:
 *       required: false
 *     responses:
 *       200:
 *         description: Execution result
 */
app.post('/transfer/complete', awaitHandler(async (req, res) => {
	logger.info('================ POST on Tranfer Complete');
	var fcn = "Complete";
	var args = [];

	let username = req.header("X-username");
	let orgName = req.header("X-orgName");

	let message = await invoke.invokeChaincode(peers, channelName, chaincodeName, args, fcn, username, orgName);
	res.send(message);
}));

app.get('/health', awaitHandler(async (req, res) => {
	res.sendStatus(200);
}));

/************************************************************************************
 * Error handler
 ************************************************************************************/
app.use(function(error, req, res, next) {
	res.status(500).json({ error: error.toString() });
});
