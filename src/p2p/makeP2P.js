const utils = require('../utils');

exports.makeP2P = ({ hive, validatorDatabase, eventEmitter }) => {
  return Object.freeze({
    listen,
    sendEventByName
  });

  async function listen(){
    eventEmitter.on('new_block', (block_num, block) => {
      for (const transaction of block.transactions) {
        for (const op of transaction.operations){
          const [type, data] = op;

          if (type === 'custom_json' && data.id === process.env.CUSTOM_JSON_ID && data.required_auths && data.required_auths.length > 0){
            processTransaction(data, transaction.transaction_id)
          }
        }
      }
    });
  }

  async function processTransaction(data, transaction_id){
    try {
      const json = JSON.parse(data.json);
      const tx_data = JSON.parse(json.data);

      switch (json.name) {
        case 'proposed_transaction':
            eventEmitter.emit("proposed_transaction", tx_data, transaction_id);
          break;
        case 'signature':
          eventEmitter.emit("signature", tx_data, data.required_auths);
          break;
        case 'network_state':
          eventEmitter.emit("network_state", tx_data);
          break;
        case 'propose_validator_removal':
          eventEmitter.emit("propose_validator_removal", tx_data);
          break;
        case 'propose_new_validator':
          eventEmitter.emit("propose_new_validator", tx_data);
          break;
        case 'whitelist_validator':
          if (data.required_auths[0] == process.env.VALIDATOR){
            eventEmitter.emit("whitelist_validator", tx_data);
          };
          break;
      }
    } catch (e) {
      console.log(e);
    }
  }

  async function sendEventByName(eventName, eventData) {
    try {
      const result = await hive.sendCustomJson(eventName, JSON.stringify(eventData));
      utils.log(`Sent [${eventName}] in tx [${result.id}]`);
      return result;
    } catch (e) {
      console.log(e);
      return false;
    }
  }
}
