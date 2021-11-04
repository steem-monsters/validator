const fs = require('fs');
const utils = require('../utils');
const { Hive } = require('@splinterlands/hive-interface');
const dhive = require('@hiveio/dhive');
const Web3 = require('web3');
const InputDataDecoder = require('ethereum-input-data-decoder');

const { eventEmitter } = require("../eventHandler/index.js");
const { spsABI } = require("../utils/spsABI.js");
const { multisigABI } = require("../utils/multisigABI.js");

const EthInterface = require('@splinterlands/eth-interface');
const eth_interface = new EthInterface({ 
  rpc_nodes: [process.env.ETHEREUM_ENDPOINT], 
  chain: process.env.CHAIN_NAME, 
  chain_id: process.env.ETHEREUM_CHAIN_ID,
  save_state: (state) => {
    // Save the last block read to disk
		fs.writeFile('./state-eth.json', JSON.stringify(state), function (err) {
			if (err)
				utils.log(err);
		});
  },
  load_state: () => {
		// Check if state has been saved to disk, in which case load it
		if (fs.existsSync('./state-eth.json')) {
			let state = JSON.parse(fs.readFileSync('./state-eth.json'));
			utils.log('Restored saved state: ' + JSON.stringify(state));
			return state;
		}
  }
});

const hive = new Hive();
const web3 = new Web3(process.env.ETHEREUM_ENDPOINT);
const inputDataDecoder = new InputDataDecoder(spsABI);

const { buildMakeHiveInterface } = require("./hive.js");
const { buildMakeEthereumInterface } = require("./ethereum.js");

const makeHiveInterface = buildMakeHiveInterface({ hive, eventEmitter, dhive })
const makeEthereumInterface = buildMakeEthereumInterface({ web3, eth_interface, eventEmitter, tokenABI: spsABI, multisigABI, inputDataDecoder })

module.exports.hive = makeHiveInterface
module.exports.ethereum = makeEthereumInterface
