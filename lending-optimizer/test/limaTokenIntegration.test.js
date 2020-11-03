const { createFixtureLoader, solidity } = require("ethereum-waffle");
const { expect, use } = require("chai");
const fs = require("fs");
const { BigNumber } = require("@ethersproject/bignumber");
const { advanceTime } = require("./utils/time");
const { packData } = require("./utils/packData");

const {
  dai,
  usdc,
  usdt,
  cDai,
  cUsdc,
  cUsdt,
  aDai,
  aUsdc,
  aUsdt,
  link,
  aave,
} = require("./utils/constants");
use(solidity);

describe("LimaTokenIntegration", function () {
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
  let limaSwap, LimaSwapContract, limaOracle, TokenHelperContract, tokenHelper;
  let daiContract,
    usdcContract,
    usdtContract,
    aDaiContract,
    aUsdcContract,
    aUsdtContract,
    cDaiContract,
    cUsdcContract,
    cUsdtContract,
    linkContract,
    aaveContract;
  // contract enum values
  const NOT_FOUND = 0;
  const COMPOUND = 1;
  const AAVE = 2;
  const STABLE_COIN = 1;
  const INTEREST_TOKEN = 2;
  const zero = "0";
  const one = "1";
  const two = "2";
  const four = ethers.utils.parseEther("4");
  const five = ethers.utils.parseEther("5");
  const ten = "10";

  const create = async (limaToken, investmentToken, amount, user) => {
    // const minimumReturn = await tokenHelper.getExpectedReturnCreate(
    //   investmentToken,
    //   amount
    // );
    //todo make getExpectedReturnCreate work
    const minimumReturn = 0;
    await limaToken
      .connect(user)
      .create(investmentToken, amount, await user.getAddress(), minimumReturn);
  };
  const redeem = async (limaToken, investmentToken, amount, user) => {
    //todo
    // const minimumReturn = await tokenHelper.getExpectedReturnRedeem(
    //   investmentToken,
    //   amount
    // );
    const minimumReturn = 0;

    await limaToken
      .connect(user)
      .redeem(investmentToken, amount, await user.getAddress(), minimumReturn);
  };

  let provider;
  before(async () => {
    provider = ethers.provider;
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
    daiContract = await ethers.getContractAt("IERC20", dai);
    usdcContract = await ethers.getContractAt("IERC20", usdc);
    usdtContract = await ethers.getContractAt("IERC20", usdt);

    aDaiContract = await ethers.getContractAt("IERC20", aDai);
    aUsdcContract = await ethers.getContractAt("IERC20", aUsdc);
    aUsdtContract = await ethers.getContractAt("IERC20", aUsdt);

    cDaiContract = await ethers.getContractAt("IERC20", cDai);
    cUsdcContract = await ethers.getContractAt("IERC20", cUsdc);
    cUsdtContract = await ethers.getContractAt("IERC20", cUsdt);

    linkContract = await ethers.getContractAt("IERC20", link);
    aaveContract = await ethers.getContractAt("IERC20", aave);

    LimaSwapContract = await ethers.getContractFactory("LimaSwap");

    // initialize after proxy deployment
    limaSwap = await upgrades.deployProxy(LimaSwapContract, null, {
      initializer: "initialize",
      unsafeAllowCustomTypes: true,
    });

    const maxUint = await limaSwap.MAX_UINT256();

    await daiContract.approve(limaSwap.address, maxUint);
    await usdcContract.approve(limaSwap.address, maxUint);
    await usdtContract.approve(limaSwap.address, maxUint);

    await cUsdtContract.approve(limaSwap.address, maxUint);
    await cUsdcContract.approve(limaSwap.address, maxUint);
    await cDaiContract.approve(limaSwap.address, maxUint);

    await aUsdtContract.approve(limaSwap.address, maxUint);
    await aUsdcContract.approve(limaSwap.address, maxUint);
    await aDaiContract.approve(limaSwap.address, maxUint);

    const underlyingTokens = [
      cUsdtContract.address,
      cUsdcContract.address,
      cDaiContract.address,
      aUsdtContract.address,
      aUsdcContract.address,
      aDaiContract.address,
    ];

    const OracleContract = await ethers.getContractFactory("FakeOracle");
    limaOracle = await upgrades.deployProxy(OracleContract);

    TokenHelperContract = await ethers.getContractFactory("LimaTokenHelper");

    tokenHelper = await upgrades.deployProxy(
      TokenHelperContract,
      [
        limaSwap.address,
        feeWalletAddress,
        aUsdt, //current
        underlyingTokens,
        0,
        0,
        0,
        link,
        limaOracle.address,
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

    await limaSwap.swap(token.address, usdt, aUsdt, 10, 0);

    await token.mint(user3, 1);

    // await tokenHelper.transferLimaManagerOwnership(manager.address);
    await tokenHelper.switchIsOnlyAmunUser();

    await tokenHelper.addInvestmentToken(daiContract.address);
    await tokenHelper.addInvestmentToken(usdcContract.address);
    await tokenHelper.addInvestmentToken(usdtContract.address);
  }
  describe("#rebalance", function () {
    it("rebalance (aUsdt => cUsdc)", async function () {
      await limaSwap.swap(token.address, usdt, aUsdt, 90, 0); //the should be 100 now
      //setup
      const tenEther = ethers.utils.parseEther("10");

      //todo LimaSwap cant swap aave
      // await aaveContract.transfer(token.address, 50);

      const targetCurrency = cUsdcContract;
      const AAVE = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
     

      await linkContract.transfer(token.address, ethers.utils.parseEther("0.1")); //
      // await link.mint(token.address, tenEther); //make
      await tokenHelper.setPerformanceFee(10); //1/10 = 10%

      //revert before 24 hours
      await expect(token.connect(signer2).initRebalance()).to.be.reverted;
      await advanceTime(provider, 24 * 60 * 60); //24 hours

      await token.initRebalance(); //sets IsRebalancing = true and IsOracleDataReturned = false

      expect(await tokenHelper.isRebalancing()).to.be.true;
      expect(await tokenHelper.isOracleDataReturned()).to.be.false;
      //doesn't work
      // const [
      //   bestTokenPosition,
      //   minimumReturn,
      //   minimumReturnGov,
      //   minimumReturnLink,
      // ] = await tokenHelper.getExpectedReturnRebalance(
      //   targetCurrency.address,
      //   5
      // );

      const minimumReturn = 0;
      //todo test with gov on token
      const minimumReturnGov = 0;
      //todo test with real link
      const amountToSellForLink = 0;
      const rebalanceData = packData(
        targetCurrency.address,
        BigInt(minimumReturn.toString()),
        BigInt(minimumReturnGov.toString()),
        BigInt(amountToSellForLink.toString())
      );

      //calls limatoken receiveOracleData
      await limaOracle.fakeCallToReceiveOracleData(
        token.address,
        rebalanceData
      );

      await tokenHelper.getRebalancingData();

      const [
        newToken2,
        minimumReturn2,
        minimumReturnGov2,
        amountToSellForLink2,
        minimumReturnLink2,
        governanceToken2,
      ] = await tokenHelper.getRebalancingData();
      //tests
      expect(newToken2).to.be.eq(targetCurrency.address);
      expect(minimumReturn2.toNumber()).to.be.closeTo(minimumReturn, 1);
      expect(minimumReturnGov2.toNumber()).to.be.closeTo(minimumReturnGov, 1);
      expect(amountToSellForLink2.toNumber()).to.be.closeTo(
        amountToSellForLink,
        1
      );
      expect(minimumReturnLink2).to.be.eq(10);
      expect(governanceToken2).to.be.eq(AAVE);
      // expect(await aaveContract.balanceOf(token.address)).to.be.eq(50); //todo
      expect(await linkContract.balanceOf(token.address)).to.be.eq(0);

      await token.connect(signer2).rebalance();

      expect(await tokenHelper.isRebalancing()).to.be.false;
      expect(await tokenHelper.isOracleDataReturned()).to.be.false;
      expect(await tokenHelper.currentUnderlyingToken()).to.be.eq(
        targetCurrency.address
      );
      expect(await aUsdtContract.balanceOf(token.address)).to.be.eq(0);
      expect(await targetCurrency.balanceOf(token.address)).to.be.above(0);

      expect(await aaveContract.balanceOf(token.address)).to.be.eq(0);
      // expect(await linkContract.balanceOf(token.address)).to.be.above(10); //todo

      await expect(token.connect(signer2).initRebalance()).to.be.reverted;
    });
  });
  describe("#create", function () {
    it("mints lima token from investment token (in kind)", async function () {
      await usdtContract.connect(signer).approve(token.address, 10);
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(1);
      const balanceOfUserBefore = await usdtContract.balanceOf(user);
      const balanceOfTokenBefore = await aUsdtContract.balanceOf(token.address);

      await create(token, usdtContract.address, 10, signer); //create for 10 usdt

      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(1);
      const balanceOfUserAfter = await usdtContract.balanceOf(user);
      const balanceOfTokenAfter = await aUsdtContract.balanceOf(token.address);

      expect(balanceOfUserBefore.sub(10)).to.eq(balanceOfUserAfter); //10 less USDT on user after create
      expect(balanceOfTokenBefore).to.eq(balanceOfTokenAfter.sub(10)); //10 more aUSDT on token after create
      expect(await token.balanceOf(user)).to.eq(1);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });

    it("mints lima token from investment token (NOT in kind)", async function () {
      const quantityToInvest = 1000;
      await usdcContract
        .connect(signer)
        .approve(token.address, quantityToInvest);
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(1);
      const balanceOfUserBefore = await usdcContract.balanceOf(user);
      const balanceOfTokenBefore = await aUsdtContract.balanceOf(token.address);
      const balanceOfUserLimaBefore = await token.balanceOf(user);

      await create(token, usdcContract.address, quantityToInvest, signer); //create for 10 usdt

      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(1);
      const balanceOfUserAfter = await usdcContract.balanceOf(user);
      const balanceOfTokenAfter = await aUsdtContract.balanceOf(token.address);
      const balanceOfUserLimaAfter = await token.balanceOf(user);

      expect(balanceOfUserBefore.sub(quantityToInvest)).to.eq(
        balanceOfUserAfter
      ); //10 less USDT on user after create
      expect(balanceOfTokenBefore).to.be.below(balanceOfTokenAfter); //10 more aUSDT on token after create
      expect(balanceOfUserLimaBefore).to.be.below(balanceOfUserLimaAfter);

      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });
  });

  describe("#redeem", function () {
    it("burns user lima token and pays out in payout token (in kind)", async function () {
      const quantityToInvest = 10;
      const quantityToSell = 1;

      await usdtContract
        .connect(signer)
        .approve(token.address, quantityToInvest);
      await create(token, usdtContract.address, quantityToInvest, signer); //pay 10 usdt

      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(1);
      const balanceOfTokenBefore = await aUsdtContract.balanceOf(token.address);
      const balanceOfUserBefore = await usdtContract.balanceOf(user);

      await redeem(token, usdtContract.address, quantityToSell, signer); //burn 1 lima

      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(1);
      const balanceOfUserAfter = await usdtContract.balanceOf(user);
      const balanceOfTokenAfter = await aUsdtContract.balanceOf(token.address);

      expect(balanceOfUserBefore.add(balancePerTokenBefore)).to.eq(
        balanceOfUserAfter
      ); //10 more USDT on user after redeem
      expect(balanceOfTokenBefore.sub(balancePerTokenBefore)).to.eq(
        balanceOfTokenAfter
      ); //10 less aUSDT on token after redeem
      expect(await token.balanceOf(user)).to.eq(0);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });

    it("burns user lima token and pays out in payout token (NOT in kind)", async function () {
      const quantityToInvest = 100;
      const quantityToSell = 10;

      await usdtContract
        .connect(signer)
        .approve(token.address, quantityToInvest);
      await create(token, usdtContract.address, quantityToInvest, signer); //pay 10 usdt

      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        quantityToSell
      );
      const balanceOfTokenBefore = await aUsdtContract.balanceOf(token.address);
      const balanceOfUserBefore = await usdcContract.balanceOf(user);

      await redeem(token, usdcContract.address, quantityToSell, signer); //burn 1 lima

      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(
        quantityToSell
      );
      const balanceOfUserAfter = await usdcContract.balanceOf(user);
      const balanceOfTokenAfter = await aUsdtContract.balanceOf(token.address);

      expect(balanceOfUserBefore.add(balancePerTokenBefore)).to.be.above(
        balanceOfUserAfter.sub(10)
      );
      expect(balanceOfUserBefore.add(balancePerTokenBefore)).to.be.below(
        balanceOfUserAfter.add(10)
      );
      expect(balanceOfTokenBefore.sub(balancePerTokenBefore)).to.be.above(
        balanceOfTokenAfter.sub(10) 
      );
      expect(balanceOfTokenBefore.sub(balancePerTokenBefore)).to.be.below(
        balanceOfTokenAfter.add(10) 
      );
      expect(await token.balanceOf(user)).to.be.eq(0);
      expect(balancePerTokenBefore).to.be.eq(balancePerTokenAfter);
    });
  });
});
