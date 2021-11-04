exports.buildMakeEthereumInterface = ({ web3, eth_interface, eventEmitter, tokenABI, multisigABI, inputDataDecoder }) => {
  return Object.freeze({
    streamEthereumEvents,
    getTransaction,
    decode,
    prepareAndSignMessage,
    isAddress
  });

  async function streamEthereumEvents() {
    eth_interface.stream([{
      on_event: (event) => {         
        if(event.event !== 'BridgeTransfer') return;
        eventEmitter.emit("ethereumConversion", [event]); 
      },
      contract_address: process.env.CONTRACT_ADDRESS,
      contract_abi: tokenABI
    }]);
  }

  async function getTransaction(transactionHash){
    let transaction = await web3.eth.getTransaction(transactionHash)
    // TODO: prepare definde structure of response
    return transaction;
  }

  async function decode(input){
    let decodedInput = inputDataDecoder.decodeData(input);
    // TODO: standarize output
    return decodedInput;
  }

  async function prepareAndSignMessage(to, amount, referenceTransaction){
    let contractInstance = new web3.eth.Contract(multisigABI, process.env.MULTISIG_CONTRACT_ADDRESS);
    let messageHash = await contractInstance.methods.getMessageHash(to, amount, referenceTransaction).call();
    let signature = await web3.eth.accounts.signUntrustedHash(messageHash, process.env.ETHEREUM_PRIVATE_KEY);
    return signature;
  }

  async function isAddress(address){
    let isAddress = await web3.utils.isAddress(address);
    return isAddress;
  }
}
