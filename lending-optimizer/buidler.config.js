require("dotenv").config();
usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@openzeppelin/buidler-upgrades");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("@nomiclabs/buidler-waffle");

module.exports = {
  defaultNetwork: "mainnetFork",
  networks: {
  
    forking: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      blockNumber: 11095000
    },
    mainnetFork: {
      url: "http://127.0.0.1:8545",
      network_id: 1,
      mnemonic: process.env.MNEMONIC,
      default_balance_ether: 10000000000,
      total_accounts: 10,
      gasLimit: 20000000,
      fork: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      timeout: 200000000
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: { mnemonic: process.env.MNEMONIC_TESTNET },
    },
  },
  solc: {
    version: "0.6.6",
  },
  mocha: {
    timeout: 200000
  }
};
