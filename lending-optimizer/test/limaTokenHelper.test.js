const { createFixtureLoader, solidity } = require("ethereum-waffle");
const { expect, use } = require("chai");
const { packData } = require("./utils/packData");

use(solidity);

describe("LimaTokenHelper", function () {
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
    unwrappedToken,
    notUnderlyingToken,
    TokenHelperContract,
    tokenHelper;

  const one = ethers.utils.parseEther("1");
  const two = ethers.utils.parseEther("2");
  const five = ethers.utils.parseEther("5");
  const ten = ethers.utils.parseEther("10");

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
        0
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

  describe("#initialize", function () {
    // it("adds token LimaGovernance", async function () {
    //   expect(await tokenHelper.limaGovernance()).to.eq(manager.address);
    // });

    it("adds token LimaSwap", async function () {
      expect(await tokenHelper.limaSwap()).to.eq(fakeLimaSwap.address);
    });
  });

  describe("AmunUsers", function () {
    it("switchIsOnlyAmunUser()", async function () {
      await tokenHelper.switchIsOnlyAmunUser();
      expect(await tokenHelper.isOnlyAmunUserActive()).to.be.true;
      await tokenHelper.switchIsOnlyAmunUser();
      expect(await tokenHelper.isOnlyAmunUserActive()).to.be.false;
    });
    it("addAmunUser()", async function () {
      expect(await tokenHelper.isAmunUser(user)).to.false;
      await tokenHelper.addAmunUser(user);
      expect(await tokenHelper.isAmunUser(user)).to.true;
    });
  });
  describe("View functions", function () {
    it("isUnderlyingTokens(tokenA)", async function () {
      const isUnderlying = await tokenHelper.isUnderlyingTokens(
        underlyingToken.address
      );
      expect(isUnderlying).to.be.true;
    });
    it("isUnderlyingTokens(tokenB)", async function () {
      const isUnderlying = await tokenHelper.isUnderlyingTokens(
        notUnderlyingToken.address
      );
      expect(isUnderlying).to.be.false;
    });
    it("getNetTokenValue(USD)", async function () {
      const netTokenValue = await tokenHelper.getNetTokenValue(
        underlyingToken.address
      );
      expect(netTokenValue).to.be.eq(ten);
    });
    it("getNetTokenValueOf(USD, one)", async function () {
      const netTokenValue = await tokenHelper.getNetTokenValueOf(
        underlyingToken.address,
        one
      );
      expect(netTokenValue).to.be.eq(two);
    });
  });
  describe("#addUnderlyingToken", function () {
    it("adds token to UnderlyingTokens as owner", async function () {
      expect(await tokenHelper.isUnderlyingTokens(notUnderlyingToken.address))
        .to.false;
      await tokenHelper.addUnderlyingToken(notUnderlyingToken.address);
      expect(await tokenHelper.isUnderlyingTokens(notUnderlyingToken.address))
        .to.true;
    });
    it("prevents non-owners from using addUnderlyingToken", async function () {
      await expect(
        tokenHelper
          .connect(signer2)
          .addUnderlyingToken(notUnderlyingToken.address)
      ).to.be.reverted;
    });
  });
  describe("#removeUnderlyingToken", function () {
    it("removes token from underlying tokens as owner", async function () {
      expect(await tokenHelper.isUnderlyingTokens(underlyingToken.address)).to
        .true;
      await tokenHelper.removeUnderlyingToken(underlyingToken.address);
      expect(await tokenHelper.isUnderlyingTokens(underlyingToken.address)).to
        .false;
    });
    it("prevents non-owners from using removeUnderlyingToken", async function () {
      await expect(
        tokenHelper
          .connect(signer2)
          .addUnderlyingToken(notUnderlyingToken.address)
      ).to.be.reverted;
    });
  });
  describe("#setCurrentUnderlyingToken", function () {
    it("sets currentUnderlyingToken as owner", async function () {
      expect(await tokenHelper.currentUnderlyingToken()).to.eq(
        underlyingToken.address
      );
      await tokenHelper.setCurrentUnderlyingToken(underlyingToken2.address);
      expect(await tokenHelper.currentUnderlyingToken()).to.eq(
        underlyingToken2.address
      );
    });
    it("prevents non-owners from using setCurrentUnderlyingToken", async function () {
      await expect(
        tokenHelper
          .connect(signer2)
          .setCurrentUnderlyingToken(underlyingToken2.address)
      ).to.be.reverted;
    });
  });

  const randomAddress = "0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c";
  const emptyAddress = "0x0000000000000000000000000000000000000000";

  describe("#setFeeWallet", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setFeeWallet(user2)).to.be
        .reverted;
    });

    it("doesn't allow the creation with an empty address", async () => {
      await expect(tokenHelper.setFeeWallet(emptyAddress)).to.be.reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setFeeWallet(randomAddress);
      expect(await tokenHelper.feeWallet()).to.eq(randomAddress);
    });
  });
  describe("#setLimaToken", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setLimaToken(randomAddress)).to.be
        .reverted;
    });

    it("doesn't allow the creation with an empty address", async () => {
      await expect(tokenHelper.setLimaToken(emptyAddress)).to.be.reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setLimaToken(randomAddress);
      expect(await tokenHelper.limaToken()).to.eq(randomAddress);
    });
  });

  describe("#setLimaSwap", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setLimaSwap(randomAddress)).to.be
        .reverted;
    });

    it("doesn't allow the creation with an empty address", async () => {
      await expect(tokenHelper.setLimaSwap(emptyAddress)).to.be.reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setLimaSwap(randomAddress);
      expect(await tokenHelper.limaSwap()).to.eq(randomAddress);
    });
  });
  describe("#setBurnFee", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setBurnFee(one)).to.be.reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setBurnFee(one);
      expect(await tokenHelper.burnFee()).to.eq(one);
    });
  });
  describe("#setMintFee", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setMintFee(one)).to.be.reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setMintFee(one);
      expect(await tokenHelper.mintFee()).to.eq(one);
    });
  });
  describe("#setPerformanceFee", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setPerformanceFee(one)).to.be
        .reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setPerformanceFee(one);
      expect(await tokenHelper.performanceFee()).to.eq(one);
    });
  });
  describe("#setLastUnderlyingBalancePer1000", function () {
    it("allows only owner is set variable", async () => {
      await expect(
        tokenHelper.connect(user2).setLastUnderlyingBalancePer1000(one)
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setLastUnderlyingBalancePer1000(one);
      expect(await tokenHelper.lastUnderlyingBalancePer1000()).to.eq(one);
    });
  });
  describe("#setLastRebalance", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setLastRebalance(one)).to.be
        .reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setLastRebalance(one);
      expect(await tokenHelper.lastRebalance()).to.eq(one);
    });
  });

  describe("#setRebalanceInterval", function () {
    it("allows only owner is set variable", async () => {
      await expect(tokenHelper.connect(user2).setRebalanceInterval(one)).to.be
        .reverted;
    });

    it("storages new variable", async () => {
      await tokenHelper.setRebalanceInterval(one);
      expect(await tokenHelper.rebalanceInterval()).to.eq(one);
    });
  });
 
  describe.skip("#decodeOracleData", function () {
    it("decodes data properly", async () => {
      const num1 = 2n ** 72n + 2n ** 64n;
      const num2 = BigInt("123456789012345678901234567890");
      const num3 = BigInt("0x1fffffffffffff");
      const callData = packData(link.address, num1, num2, num3);

      const data = await tokenHelper.decodeOracleData(callData);

      expect(num1 - BigInt(data.a.toString())).to.be.eq(0n);
      expect(num2 / (num2 - BigInt(data.b.toString()))).to.satisfy(
        (x) => x > 1_000_000_0n
      );
      expect(num3 / (num3 - BigInt(data.c.toString()))).to.satisfy(
        (x) => x > 1_000_000_0n
      );
    });

    it("packed data should be close to original data after unpacking", async function () {
      const newToken = underlyingToken3.address;
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
  describe.skip("#getRebalancingData", function () {
    it("packed data should be close to original data after unpacking", async function () {
      const newToken = underlyingToken3.address;
      const a = ethers.utils.parseEther("100");
      const b = 1;
      const c = ethers.utils.parseEther("1000000");

      const callData = packData(
        newToken,
        BigInt(a.toString()),
        BigInt(b.toString()),
        BigInt(c.toString())
      );

      await tokenHelper.setOracleData(callData)
      const [
        newToken2,
        a2,
        b2,
        c2,
        // minimumReturnLink2,
        // governanceToken2,
      ] = await tokenHelper.getRebalancingData();

      expect(newToken).to.be.eq(newToken2);
      expect(a2).to.be.above(ethers.utils.parseEther("97"));
      expect(b2).to.be.eq(1);
      expect(c2).to.be.above(ethers.utils.parseEther("999700"));
    });
  });

  describe("#getPerformanceFee", function () {
    //todo
  });

  describe("#getExpectedReturnRebalance", function () {
    //todo
  });
  describe("#getExpectedReturnRedeem", function () {
    //todo
  });
  describe("#getExpectedReturnCreate", function () {
    //todo
  });
});
