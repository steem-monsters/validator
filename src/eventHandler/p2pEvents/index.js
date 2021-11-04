const { hive } = require("../../blockchain/index.js")
const { validator } = require("../../validator/index.js")
const { transactionDatabase, statusDatabase } = require('../../dataAccess/index.js')
const { eventEmitter } = require("../index.js")
const { p2p } = require("../../p2p/index.js")

async function p2pEventsListener(){
  eventEmitter.on('proposed_transaction', async (data, proposalTransaction) => {
    console.log(`New proposal received on ${data.chain} for ${data.referenceTransaction}!`)
    // TODO: check if tx is already stored, if not, store it
    let currentValidator = await statusDatabase.findByName(`headValidator`)
    if (data.chain == 'hive'){
      let signedTransaction = await validator(`hive`, data.referenceTransaction, data.transaction, currentValidator[0].data);
      if (signedTransaction){
        p2p.sendEventByName(`signature`, {
          chain: 'hive',
          referenceTransaction: data.referenceTransaction,
          proposalTransaction: proposalTransaction,
          signature: signedTransaction.signatures[0]
        })
      } else {
        console.log(`Signing failed:`, signedTransaction)
      }
    } else if (data.chain == 'ethereum'){
      let signedTransaction = await validator(`ethereum`, data.referenceTransaction, '', currentValidator[0].data);
      if (signedTransaction){
        p2p.sendEventByName(`signature`, {
          chain: 'ethereum',
          referenceTransaction: data.referenceTransaction,
          proposalTransaction: proposalTransaction,
          signature: signedTransaction.signature
        })
      } else {
        console.log(`Signing failed:`, signedTransaction)
      }
    }
  })

  eventEmitter.on('signature', async (data, sender) => {
    try {
      console.log(`New signature receved from ${sender} for ${data.proposalTransaction}!`);
      
      if (data.chain == 'hive') {
        // Verify the signature received
        let signed = await hive.verifySignature(data.signature, data.referenceTransaction);
        const isValidSender = signed.includes(sender[0]);

        // Check the accounts that have authority on the multi-sig account
        let { requiredSignatures, auths } = await hive.getAuthoritiesInfo();

        // If the signature is valid from a multi-sig authority, save the signature
        if (isValidSender && auths.includes(sender[0])) {
          let isAlreadyStored = await transactionDatabase.findByReferenceID(data.referenceTransaction);
          let currentValidator = await statusDatabase.findByName(`headValidator`);
          let signatures = isAlreadyStored ? [...isAlreadyStored.signatures, data.signature] : [data.signature];

          if (!isAlreadyStored) {
            await transactionDatabase.insert({
              referenceTransaction: data.referenceTransaction,
              signatures: [data.signature]
            });
          } else {
            await transactionDatabase.pushByReferenceID(data.referenceTransaction, data.signature);
          }

          // If we have enough signatures, broadcast the transaction
          if (signatures.length >= requiredSignatures && currentValidator[0].data == process.env.VALIDATOR) {
            isAlreadyStored.transaction.signatures = signatures;
            await hive.broadcast(isAlreadyStored.transaction);
          }
        }  else {
          console.log(`Signature was signed by ${signed}, but sent by ${sender[0]}`)
        }
      } else if (data.chain == 'ethereum') {
        // NOTE: since ethereum broadcasting is handled by users, we don't have to do anything here ;)
      }
    } catch (e) {
      console.log(e)
      // TODO: handle errors
    }
  })

  eventEmitter.on('propose_new_validator', async (data) => {
    // TODO: add new propsed validator to db
  })

  eventEmitter.on('whitelist_validator', async (data) => {
    let storeNewWhitelisted = await statusDatabase.addWhitelistedValidator(data.username)
  })
}

module.exports.p2pEventsListener = p2pEventsListener
