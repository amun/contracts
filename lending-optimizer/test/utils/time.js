const { use } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

const advanceTime = async (provider, seconds) => {
  await provider.send("evm_increaseTime", [seconds]);
};

const advanceBlock = async (provider) => {
  await provider.send("evm_mine");
};

module.exports = {
  advanceTime,
  advanceBlock
};