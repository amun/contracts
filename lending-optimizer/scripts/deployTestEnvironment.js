const { deployContract, ethers, waffle } = require("@nomiclabs/buidler");

const { main } = require('./deployTestEnvironmentFunctions')

main({
  deployContract,
  ethers,
  waffle
})