const { eventEmitter } = require("../eventHandler/index.js")
const { statusDatabase } = require("../dataAccess/index.js")
const { hive } = require('../blockchain/index.js')
const validators = require("./validators.js")

async function listen() {
  validators.checkValidators();

  console.log("Listening to governance changes...")
  eventEmitter.on(`switchHeadValidator`, switchHeadValidator);
}

async function switchHeadValidator(data) {
  let newHeadValidator = await getNewHeadValidator(data.headBlock);
  console.log(`New head validator:`, newHeadValidator);

  let currentValidator = await statusDatabase.findByName(`headValidator`);

  if (!currentValidator || currentValidator.length === 0) {
    await statusDatabase.insert({ name: 'headValidator', data: newHeadValidator });
  } else {
    await statusDatabase.updateByName(`headValidator`, newHeadValidator);
  }
}

async function getNewHeadValidator(block_num) {
  const accountDetails = await hive.getAccount(process.env.HIVE_DEPOSIT_ACCOUNT);
  const scheduleNum = (block_num - block_num % 5000) / 5000;
  return accountDetails.active.account_auths[scheduleNum % accountDetails.active.account_auths.length][0];
}

module.exports.listen = listen
