const utils = require('../utils');
const BigNumber = require('bignumber.js');
const { transactionDatabase } = require("../dataAccess/index.js");

module.exports.buildMakeValidateConversionRequest = ({ hive, ethereum, transactionDatabase, isValidHash }) => {
  return async function makeValidateConversionRequest(
    conversionDirection,
    referenceTransaction,
    proposedTransaction,
    headValidator,
    createdOn = Date.now(),
    updatedOn = Date.now(),
  ){
    if (!conversionDirection){
      throw new Error(`Conversion direction is required`)
    }
    if (conversionDirection != 'hive' && conversionDirection != 'ethereum'){
      throw new Error(`Conversion direction must be hive or ethereum`)
    }
    if (!referenceTransaction){
      throw new Error(`Reference transaction is required`)
    }
    if (conversionDirection == 'hive' && (!proposedTransaction || proposedTransaction.length < 1)){
      throw new Error(`Proposed transaction is required`)
    }
    if (typeof referenceTransaction != 'string'){
      throw new Error(`Reference transaction must be a string`)
    }
    if (conversionDirection == 'hive' && (typeof proposedTransaction != 'object' && typeof proposedTransaction != 'string')){
      throw new Error(`Proposed transaction must be object or string`)
    }

    let signedTransaction = false;
    try {
      if (conversionDirection == 'hive'){
        signedTransaction = await validateConversionToHive(referenceTransaction, proposedTransaction, headValidator)
      } else {
        signedTransaction = await validateConversionToEthereum(referenceTransaction, proposedTransaction)
      }
    } catch (e) {
      console.log(`signedTransaction failed or rejected: ${e.message}`)
    }

    return signedTransaction;
  }

  async function validateConversionToHive(referenceTransaction, transaction, headValidator){
    if (typeof transaction == 'string') transaction = JSON.parse(transaction)
    let ethereumTransaction = await ethereum.getTransaction(referenceTransaction);
    let decodedTransactionData = await ethereum.decode(ethereumTransaction.input);

    if (ethereumTransaction.to.toLowerCase() !== process.env.CONTRACT_ADDRESS.toLowerCase()) {
      throw new Error(`Transaction must be to selected smart contract`);
    }

    if (decodedTransactionData.method !== process.env.CONTRACT_METHOD) {
      throw new Error(`Method must be ${process.env.CONTRACT_METHOD}`);
    }

    if (transaction.operations[0][0] !== 'custom_json' && transaction.operations[0][1].id === `${process.env.CUSTOM_JSON_ID_PREFIX}token_transfer`) {
      throw new Error(`Transaction operation must be "token_transfer".`);
    }

    const hive_tx_data = utils.tryParse(transaction.operations[0][1].json);
    const hive_fee_tx_data = utils.tryParse(transaction.operations[1][1].json);

    const integer_amount = new BigNumber(decodedTransactionData.inputs[1].toString());
    const amount = parseFloat(parseFloat(integer_amount.dividedBy(`1e+${process.env.ETHEREUM_TOKEN_PRECISION}`).toString()).toFixed(3));

    if (amount * (1 - process.env.FEE_PCT / 100) !== parseFloat(hive_tx_data.qty)) {
      throw new Error(`Amount sent [${amount * (1 - process.env.FEE_PCT / 100)}] must match proposed amount [${parseFloat(hive_tx_data.qty)}].`);
    }

    if (hive_tx_data.token !== process.env.TOKEN_SYMBOL) {
      throw new Error(`Proposed transfer currency [${hive_tx_data.token}] does not match expected currency [${process.env.TOKEN_SYMBOL}]`);
    }

    if (decodedTransactionData.inputs[2] !== hive_tx_data.to) {
      throw new Error(`Recipient address on transaction [${decodedTransactionData.inputs[2]}] must match proposed recepient [${hive_tx_data.to}].`)
    }

    if (transaction.operations.length > 2) {
      throw new Error(`Only 2 operations allowed.`);
    }

    if (transaction.operations[1][0] !== 'custom_json' && transaction.operations[1][1].id === `${process.env.CUSTOM_JSON_ID_PREFIX}token_transfer`) {
      throw new Error(`2nd transaction operation must be "token_transfer".`);
    }

    if (amount * (process.env.FEE_PCT / 100) !== parseFloat(hive_fee_tx_data.qty)) {
      throw new Error(`Validator fee [${amount * (process.env.FEE_PCT / 100)}] does not proposed fee [${parseFloat(hive_fee_tx_data.qty)}].`);
    }

    if (hive_fee_tx_data.to !== headValidator) {
      throw new Error(`Proposed transaction sending fee tx to [${hive_fee_tx_data.to}] instead of current head validator [${headValidator}].`);
    }

    // Update the proposed transaction on the reference transaction in the database
    transactionDatabase.updateByReferenceID(referenceTransaction, { transaction });

    let signedTransaction = await hive.sign(transaction);
    return signedTransaction;
  }

  async function validateConversionToEthereum(referenceTransaction){
    let hiveTransaction = await hive.getTransactionByID(referenceTransaction);

    if (hiveTransaction.operations[0][0] != 'transfer'){
      throw new Error(`Transaction is not transfer`)
    }
    if (hiveTransaction.operations[0][1].to != process.env.HIVE_DEPOSIT_ACCOUNT){
      throw new Error(`Recipient is not deposit account`)
    }
    if (!ethereum.isAddress(hiveTransaction.operations[0][1].memo)){
      throw new Error(`Memo is not ethereum address`)
    }
    let to = hiveTransaction.operations[0][1].memo;
    let amount = hiveTransaction.operations[0][1].amount.split(" ")[0] * Math.pow(10, process.env.TOKEN_PRECISION);
    let signedTransaction = await ethereum.prepareAndSignMessage(to, amount, referenceTransaction);
    return signedTransaction;
  }
}
