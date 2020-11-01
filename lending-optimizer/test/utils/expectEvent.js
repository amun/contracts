const chai = require('chai');
chai.use(require('chai-bignumber')());
const { expect } = chai

const expectEvent = function (receipt, eventName, eventArgs = {}) {
  if (isWeb3Receipt(receipt)) {
    const logs = receipt.events.map(obj => {
      if (obj.event && obj.args) {
        return ({ event: obj.event, args: obj.args });
      }
    }).filter(Boolean);
    inLogs(logs, eventName, eventArgs);
  } else {
    throw new Error('Unknown transaction receipt object');
  }
}

const isWeb3Receipt = function (receipt) {
  return 'events' in receipt && typeof receipt.events === 'object';
}

const isBN = function (object) {
  return object && object.constructor && object.constructor.name === 'BigNumber';
}

const inLogs = function (logs, eventName, eventArgs = {}) {
  const events = logs.filter(e => e.event === eventName);
  expect(events.length > 0).to.equal(true, `No '${eventName}' events found`);

  const exception = [];
  const event = events.find(function (e) {
    for (const [k, v] of Object.entries(eventArgs)) {
      try {
        contains(e.args, k, v);
      } catch (error) {
        exception.push(error);
        return false;
      }
    }
    return true;
  });

  if (event === undefined) {
    throw exception[0];
  }

  return event;
}

const contains = function (args, key, value) {
  expect(key in args).to.equal(true, `Event argument '${key}' not found`);

  if (value === null) {
    expect(args[key]).to.equal(null,
      `expected event argument '${key}' to be null but got ${args[key]}`);
  } else if (isBN(args[key]) || isBN(value)) {
    const actual = isBN(args[key]) ? args[key].toString() : args[key];
    const expected = isBN(value) ? value.toString() : value;
    expect(args[key].toString()).to.be.bignumber.equal(value.toString(),
      `expected event argument '${key}' to have value ${expected} but got ${actual}`);
  } else {
    expect(args[key]).to.be.deep.equal(value,
      `expected event argument '${key}' to have value ${value} but got ${args[key]}`);
  }
}

module.exports = expectEvent;
