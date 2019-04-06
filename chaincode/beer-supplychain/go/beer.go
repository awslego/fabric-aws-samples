/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/*
 * The sample smart contract for documentation topic:
 * Writing Your First Blockchain Application
 */

package main

/* Imports
 * 4 utility libraries for formatting, handling bytes, reading and writing JSON, and string manipulation
 * 2 specific Hyperledger Fabric specific libraries for Smart Contracts
 */
import (
	"bytes"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
	"time"
)

// Define the Smart Contract structure
type SmartContract struct {
}

/* enum StateType*/
const (
	Creating = "0"            			 // 0
	Created = "1"                        // 1
	TransitionRequestPending= "2"        // 2
	InTransit = "3"                      // 3
	Completed  = "4"                     // 4
	OutOfCompliance  = "5"               // 5
)

type Order struct {
	State string `json:state"`
	Count  string `json:"count"`
	Owner  string `json:"owner"`
	Ctime string `json:"ctime"`
	Utime string `json:"utime"`
}

var State string;
var RequestedCount string;
var FirstCount string;
var Counterparty string;
var PreviousCounterparty string;
var RequestedCounterparty string;

func (s *SmartContract) Init(APIstub shim.ChaincodeStubInterface) sc.Response {
	return shim.Success(nil)
}

func (s *SmartContract) Invoke(APIstub shim.ChaincodeStubInterface) sc.Response {

	// Retrieve the requested Smart Contract function and arguments
	function, args := APIstub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately
	
	if function == "initLedger" {
		return s.initLedger(APIstub)
	} else if function == "queryOrder" {
		return s.queryOrder(APIstub, args)
	} else if function == "queryAllOrder" {
		return s.queryAllOrder(APIstub)
	} else if function == "createOrder" {
		return s.createOrder(APIstub, args)
	} else if function == "changeOrder" {
		return s.changeOrder(APIstub, args)

	} else if function == "Complete" {
		return s.Complete(APIstub)
	} else if function == "acceptTransfer" {
		return s.acceptTransfer(APIstub)
	} else if function == "startTransfer" {
		return s.startTransfer(APIstub, args)
	} else if function == "requestTransfer" {
		return s.requestTransfer(APIstub, args)
	}

	return shim.Error("Invalid Smart Contract function name.")
}

func (s *SmartContract) initLedger(APIstub shim.ChaincodeStubInterface) sc.Response {
	t :=time.Now()
	orders := []Order{
		Order{State: Created, Count: "0", Owner: "Genesis", Ctime:t.Format(time.RFC1123), Utime:t.Format(time.RFC1123) },
	}


	i := 0
	for i < len(orders) {
		fmt.Println("i is ", i)
		orderAsBytes, _ := json.Marshal(orders[i])
		APIstub.PutState("ORDER"+strconv.Itoa(i), orderAsBytes)
		fmt.Println("Added", orders[i])
		i = i + 1
	}

	State = Created

	return shim.Success(nil)
}

func (s *SmartContract) queryOrder(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 1 {
		return shim.Error("Incorrect number of arguments. Expecting 1")
	}

	orderAsBytes, _ := APIstub.GetState(args[0])
	return shim.Success(orderAsBytes)
}

func (s *SmartContract) queryAllOrder(APIstub shim.ChaincodeStubInterface) sc.Response {

	startKey := "ORDER0"
	endKey := "ORDER999"

	resultsIterator, err := APIstub.GetStateByRange(startKey, endKey)
	if err != nil {
		return shim.Error(err.Error())
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return shim.Error(err.Error())
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}
		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllOrders:\n%s\n", buffer.String())

	return shim.Success(buffer.Bytes())
}

func (s *SmartContract) createOrder(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 4 {
		return shim.Error("Incorrect number of arguments. Expecting 3")
	}

	currAsBytes, _ := APIstub.GetState("ORDER0")
	curr := Order{}
	json.Unmarshal(currAsBytes, &curr)


	t :=time.Now()
	var order = Order{State: args[1], Count: args[2], Owner: args[3], Ctime:curr.Ctime, Utime:t.Format(time.RFC1123)}

	orderAsBytes, _ := json.Marshal(order)
	APIstub.PutState(args[0], orderAsBytes)

	return shim.Success(nil)
}

func (s *SmartContract) changeOrder(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 3 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	orderAsBytes, _ := APIstub.GetState(args[0])
	order := Order{}
	json.Unmarshal(orderAsBytes, &order)

	if args[1] == "State" {
		order.State = args[2]
	} else if args[1] == "Count" {
		order.Count = args[2]
	} else if args[1] == "Owner" {
		order.Owner = args[2]
	}
	order.Utime = (time.Now()).Format(time.RFC1123)

	orderAsBytes, _ = json.Marshal(order)
	APIstub.PutState(args[0], orderAsBytes)

	return shim.Success(nil)
}



func (s *SmartContract) startTransfer(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	orderAsBytes, _ := APIstub.GetState("ORDER0")
	order := Order{}
	json.Unmarshal(orderAsBytes, &order)

	//if (Counterparty != APIstub.getCreator() || (State != Created && State != InTransit) || newCounterparty == Device ) {
	//creatorBytes, _ := APIstub.GetCreator()

	if (order.State != Created ) {
		return shim.Error("Incorect state  3")
	}

	order.Owner = args[0];
	FirstCount = args[1];
	order.Count = FirstCount
	order.State = TransitionRequestPending;
	order.Utime = (time.Now()).Format(time.RFC1123)

	orderAsBytes, _ = json.Marshal(order)
	APIstub.PutState("ORDER0", orderAsBytes)

	return shim.Success([]byte(order.State))
}

func (s *SmartContract) acceptTransfer(APIstub shim.ChaincodeStubInterface) sc.Response {

	orderAsBytes, _ := APIstub.GetState("ORDER0")
	order := Order{}
	json.Unmarshal(orderAsBytes, &order)

	//if (RequestedCounterparty != msg.sender || State != StateType.TransitionRequestPending)

	if (order.State != TransitionRequestPending) {
		return shim.Error("Incorect state 2")
	}

	order.State = InTransit;
	order.Utime = (time.Now()).Format(time.RFC1123)

	orderAsBytes, _ = json.Marshal(order)
	APIstub.PutState("ORDER0", orderAsBytes)

	return shim.Success([]byte(order.State))
}

func (s *SmartContract) requestTransfer(APIstub shim.ChaincodeStubInterface, args []string) sc.Response {

	if len(args) != 2 {
		return shim.Error("Incorrect number of arguments. Expecting 2")
	}

	orderAsBytes, _ := APIstub.GetState("ORDER0")
	order := Order{}
	json.Unmarshal(orderAsBytes, &order)

	//if (Counterparty != ms.sender || (State != Created && State != InTransit) || newCounterparty == Device ) {

	if (order.State != InTransit) {
		return shim.Error("Incorect state  4")
	}

	order.Owner = args[0];
	order.Count = args[1]
	order.State = TransitionRequestPending;
	order.Utime = (time.Now()).Format(time.RFC1123)

	orderAsBytes, _ = json.Marshal(order)
	APIstub.PutState("ORDER0", orderAsBytes)

	return shim.Success([]byte(order.State))
}

func (s *SmartContract) Complete(APIstub shim.ChaincodeStubInterface) sc.Response {

	orderAsBytes, _ := APIstub.GetState("ORDER0")
	order := Order{}
	json.Unmarshal(orderAsBytes, &order)


	//if (SupplyChainOwner != msg.sender || State != StateType.InTransit)

	if (order.State != InTransit) {
		return shim.Error("Incorect state  1")
	}

	order.State = Completed;
	if (FirstCount != order.Count ) {
		order.State = OutOfCompliance;
	}
	order.Utime = (time.Now()).Format(time.RFC1123)

	orderAsBytes, _ = json.Marshal(order)
	APIstub.PutState("ORDER0", orderAsBytes)

	return shim.Success([]byte(order.State))
}


// The main function is only relevant in unit test mode. Only included here for completeness.
func main() {

	// Create a new Smart Contract
	err := shim.Start(new(SmartContract))
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}




