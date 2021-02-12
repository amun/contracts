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
  let limaSwap, LimaSwapContract, TokenHelperContract, tokenHelper;
  let daiContract,
    usdcContract,
    usdtContract,
    aDaiContract,
    aUsdcContract,
    aUsdtContract,
    cDaiContract,
    cUsdcContract,
    cUsdtContract,
    aaveContract;

  const create = async (limaToken, investmentToken, amount, user) => {
    let minimumReturn = await tokenHelper.getExpectedReturnCreate(
      investmentToken,
      amount
    );
    if (minimumReturn.gte(1)) {
      minimumReturn = minimumReturn.sub(1); //todo is this correct?
    }
    await limaToken
      .connect(user)
      .create(investmentToken, amount, await user.getAddress(), minimumReturn);
  };
  const redeem = async (limaToken, investmentToken, amount, user) => {
    let minimumReturn = await tokenHelper.getExpectedReturnRedeem(
      investmentToken,
      amount
    );
    if (minimumReturn.gte(1)) {
      minimumReturn = minimumReturn.sub(1); //todo is this correct?
    }
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

    // await tokenHelper.transferLimaGovernanceOwnership(manager.address);
    await tokenHelper.switchIsOnlyAmunUser();

    await tokenHelper.addInvestmentToken(daiContract.address);
    await tokenHelper.addInvestmentToken(usdcContract.address);
    await tokenHelper.addInvestmentToken(usdtContract.address);
  }
  describe("#rebalance", function () {
    it("rebalance (aUsdt => cUsdc)", async function () {
      await limaSwap.swap(token.address, usdt, aUsdt, 90, 0); //the should be 100 now
      //setup

      await aaveContract.transfer(token.address, 1e14);

      const targetCurrency = cUsdcContract;

      await tokenHelper.setPerformanceFee(10); //1/10 = 10%

      //revert before 24 hours
      await advanceTime(provider, 24 * 60 * 60); //24 hours


      const minimumReturnGov = await tokenHelper.getExpectedReturnRebalance(
        targetCurrency.address
      );
      await token.rebalance(targetCurrency.address, minimumReturnGov);

      expect(await tokenHelper.currentUnderlyingToken()).to.be.eq(
        targetCurrency.address
      );
      expect(await aUsdtContract.balanceOf(token.address)).to.be.eq(0);
      expect(await targetCurrency.balanceOf(token.address)).to.be.above(0);

      expect(await aaveContract.balanceOf(token.address)).to.be.eq(0);

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
