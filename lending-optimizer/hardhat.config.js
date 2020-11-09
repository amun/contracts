module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      forking: {
        url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`
      },
      accounts: {
        mnemonic: process.env.MNEMONIC,
        accountBalance: 10000000000,

      },
      chainId: 1337,
      timeout: 200000000
    },
  },
  solidity: {
    version: "0.6.12",
  },
};
