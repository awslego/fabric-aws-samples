# fabric-aws-samples


## execution instructions
### 1.1 Chaincode (golang)

```
$ cd fabric-aws-samples/
$ cd chaincode/beer-supplychain

$ go run beer.go     
```

### 1.2 Start Fabric (shell)

```
$ cd fabric-aws-samples
$ cd beer-supplychain

$ ./startFabric.sh go      // only once at first
$ ./upgradeFabric.sh go    // When chaincode is changed
```


  
### 1.2 Chaincode Test (nodejs)

```
$ cd fabric-aws-samples
$ cd beer-supplychain/javascript

$ node query                   
$ node invoke 0           // init
$ node invoke 1           // device
$ node invoke 2           // manufacturer
$ node invoke 3           // distributer
$ node invoke 4           // beer house
```


#### reference 
https://hyperledger-fabric.readthedocs.io/en/release-1.4/getting_started.html
https://hyperledger-fabric.readthedocs.io/en/release-1.4/write_first_app.html