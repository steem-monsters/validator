const { eventEmitter } = require("../index.js");
const { validator } = require("../../validator/index.js");
const { transactionDatabase, statusDatabase } = require('../../dataAccess/index.js');
const { p2p } = require("../../p2p/index.js");
const { hive, ethereum } = require("../../blockchain/index.js");
const BigNumber = require('bignumber.js');

async function blockchainEventsListener(){
  eventEmitter.on(`hiveConversion`, async (data) => {
    console.log(`New hive deposit from ${data.from} for ${data.amount}.`)
    let isAlreadyProcessed = await transactionDatabase.findByReferenceID(data.transaction_id);
    if (!isAlreadyProcessed){
      let currentValidator = await statusDatabase.findByName(`headValidator`)
      if (currentValidator[0].data == process.env.VALIDATOR){
        await transactionDatabase.insert({
          chain: 'ethereum',
          referenceTransaction: data.transaction_id,
          isProcessed: false,
          headValidator: process.env.VALIDATOR,
          createdAt: new Date().getTime(),
          signatures: []
        });
        p2p.sendEventByName('proposed_transaction', {
          chain: 'ethereum',
          referenceTransaction: data.transaction_id
        })
      } else {
        await transactionDatabase.insert({
          chain: 'ethereum',
          referenceTransaction: data.transaction_id,
          isProcessed: false,
          headValidator: currentValidator[0].data,
          createdAt: new Date().getTime(),
          signatures: []
        });
      }
    }
  })

  eventEmitter.on(`ethereumConversion`, async (data) => {
    let notProcessedTransactions = [];

    for (i in data){
      let isAlreadyProcessed = await transactionDatabase.findByReferenceID(data[i].transactionHash)
      if (!isAlreadyProcessed) notProcessedTransactions.push(data[i])
    }

    console.log(`${notProcessedTransactions.length} ethereum conversion(s) transactions not processed.`);

    for (i in notProcessedTransactions) {
      const tx = notProcessedTransactions[i];

      // Check if the current validator is the head validator, in which case it should propose the transaction
      let currentValidator = await statusDatabase.findByName(`headValidator`);

      if (currentValidator[0].data == process.env.VALIDATOR) {
        const integer_amount = new BigNumber(tx.returnValues.amount);
        const amount = parseFloat(parseFloat(integer_amount.dividedBy(`1e+${process.env.ETHEREUM_TOKEN_PRECISION}`).toString()).toFixed(3));

        let preparedTransaction = await hive.prepareTransferTransaction({
          from: process.env.HIVE_DEPOSIT_ACCOUNT,
          to: tx.returnValues.externalAddress,
          amount,
          currency: process.env.TOKEN_SYMBOL,
          headValidator: currentValidator[0].data,
          referenceTransaction: tx.transactionHash
        });

        await transactionDatabase.insert({
          chain: 'hive',
          referenceTransaction: tx.transactionHash,
          //transaction: preparedTransaction,
          isProcessed: false,
          headValidator: process.env.VALIDATOR,
          createdAt: new Date().getTime(),
          signatures: []
        });

        p2p.sendEventByName('proposed_transaction', {
          chain: 'hive',
          referenceTransaction: tx.transactionHash,
          transaction: JSON.stringify(preparedTransaction)
        });
      } else {
        await transactionDatabase.insert({
          chain: 'hive',
          referenceTransaction: tx.transactionHash,
          transaction: false,
          isProcessed: false,
          headValidator: currentValidator[0].data,
          createdAt: new Date().getTime(),
          signatures: []
        });
      }
    }
  })
}

module.exports.blockchainEventsListener = blockchainEventsListener
