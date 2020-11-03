const { createFixtureLoader, solidity } = require("ethereum-waffle");
const { expect, use } = require("chai");
const fs = require("fs");
const { BigNumber } = require("@ethersproject/bignumber");
const { advanceTime } = require("./utils/time");

const { spawnSync } = require("child_process");
const {
  LinkToken: LinkTokenContract,
} = require("@chainlink/contracts/truffle/v0.4/LinkToken");
const {
  Oracle: OracleContract,
} = require("@chainlink/contracts/truffle/v0.6/Oracle");
const {
  initializeChainlinkNode,
} = require("../scripts/deployTestEnvironmentFunctions");
const { packData } = require("./utils/packData");
use(solidity);

describe.skip("Oracle", function () {
  let loadFixture;

  let user,
    user2,
    user3,
    signer,
    signer2,
    signer3,
    token,
    TokenContract,
    feeWallet,
    feeWalletAddress;
  let fakeLimaSwap,
    FakeLimaSwapContract,
    underlyingToken,
    underlyingToken2,
    underlyingToken3,
    govToken,
    link,
    oracle,
    limaOracle,
    unwrappedToken,
    TokenHelperContract,
    tokenHelper,
    oracleAddresses,
    LimaOracleContract;

  const five = ethers.utils.parseEther("5");

  before(async () => {
    const provider = ethers.provider;
    const signers = await provider.listAccounts();
    loadFixture = createFixtureLoader(signers, provider);

    [signer, signer2, signer3, feeWallet] = await ethers.getSigners();
    user = await signer.getAddress();
    user2 = await signer2.getAddress();
    user3 = await signer3.getAddress();
    feeWalletAddress = await feeWallet.getAddress();
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  async function fixture() {
    const OracleContract = await ethers.getContractFactory("FakeOracle");
    const fakeLimaOracle = await upgrades.deployProxy(OracleContract);

    FakeInvestmentTokenContract = await ethers.getContractFactory(
      "FakeInvestmentToken"
    );
    underlyingToken = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["Fake Token", "FK1"],
      { initializer: "initialize" }
    );
    underlyingToken2 = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["Fake Token 2", "FK2"],
      { initializer: "initialize" }
    );
    underlyingToken3 = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["Fake Token 3", "FK3"],
      { initializer: "initialize" }
    );
    notUnderlyingToken = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["Fake Token 4", "FK4"],
      { initializer: "initialize" }
    );
    unwrappedToken = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["Fake Unwrapped Token", "UWT"],
      { initializer: "initialize" }
    );
    const govToken = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["Fake Unwrapped Token", "UWT"],
      { initializer: "initialize" }
    );
    link = await upgrades.deployProxy(
      FakeInvestmentTokenContract,
      ["LINK", "LINK"],
      { initializer: "initialize" }
    );
    FakeLimaSwapContract = await ethers.getContractFactory("FakeLimaSwap");
    fakeLimaSwap = await upgrades.deployProxy(
      FakeLimaSwapContract,
      [unwrappedToken.address, govToken.address],
      { initializer: "initialize" }
    );

    const underlyingTokens = [
      underlyingToken.address,
      underlyingToken2.address,
      underlyingToken3.address,
    ];
    TokenHelperContract = await ethers.getContractFactory("LimaTokenHelper");
    tokenHelper = await upgrades.deployProxy(
      TokenHelperContract,
      [
        fakeLimaSwap.address,
        feeWalletAddress,
        underlyingToken.address,
        underlyingTokens,
        0,
        0,
        0,
        link.address,
        fakeLimaOracle.address,
      ],
      { initializer: "initialize" }
    );

    TokenContract = await ethers.getContractFactory("LimaToken");
    token = await upgrades.deployProxy(
      TokenContract,
      ["LIMA Token", "LTK", tokenHelper.address, 0, 0],
      { initializer: "initialize" }
    );
    await tokenHelper.setLimaToken(token.address);

    await underlyingToken.mint(token.address, five);
    await token.mint(user3, five);

    await tokenHelper.switchIsOnlyAmunUser();

    await tokenHelper.addInvestmentToken(underlyingToken.address);
    await tokenHelper.addInvestmentToken(underlyingToken2.address);
    await tokenHelper.addInvestmentToken(underlyingToken3.address);
  }

  describe("#receiveOracleData", function () {
    beforeEach(async () => {
      console.log("Shutting down chainlink service");
      const stopChainlink = spawnSync("docker-compose", ["stop", "chainlink"]);
      const rmChainlink = spawnSync("docker-compose", [
        "rm",
        "-f",
        "chainlink",
      ]);
      const stopDb = spawnSync("docker-compose", ["stop", "dbchainlink"]);
      const rmDb = spawnSync("docker-compose", ["rm", "-f", "dbchainlink"]);
      const startDb = spawnSync("docker-compose", ["up", "-d", "dbchainlink"]);

      const { jobId } = await initializeChainlinkNode(oracle, signer);
      const limaOracle = await LimaOracleContract.deploy(
        oracleAddresses.ORACLE_CONTRACT_ADDRESS,
        oracleAddresses.LINK_CONTRACT_ADDRESS,
        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(jobId)),
        "http://172.17.0.1:3060/best-lending-pool?force_address=0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9"
      );
      await tokenHelper.setLimaOracle(limaOracle.address);
    });
    it("should get requested data", async function () {
      let result = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          token.removeAllListeners("ReadyForRebalance");
          reject();
        }, 60000);
        token.on("ReadyForRebalance", (...data) => {
          clearTimeout(timeout);
          resolve();
          token.removeAllListeners("ReadyForRebalance");
        });
      });
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      await token.initRebalance();
      await result;
      expect(await tokenHelper.isRebalancing()).to.be.true;
      expect(await tokenHelper.isOracleDataReturned()).to.be.true;
    });
  });

  describe("#decodeOracleData", function () {

    it("packed data should be close to original data after unpacking", async function () {
      const newToken = underlyingToken2.address;
      const a = ethers.utils.parseEther("100");
      const b = 1;
      const c = ethers.utils.parseEther("1000000");

      const callData = packData(
        newToken,
        BigInt(a.toString()),
        BigInt(b.toString()),
        BigInt(c.toString())
      );
      const [newToken2, a2, b2, c2] = await tokenHelper.decodeOracleData(
        callData
      );

      expect(newToken).to.be.eq(newToken2);
      expect(a2).to.be.above(ethers.utils.parseEther("97"));
      expect(b2).to.be.eq(1);
      expect(c2).to.be.above(ethers.utils.parseEther("999700"));
    });
  });
});
