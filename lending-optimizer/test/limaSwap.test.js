const { createFixtureLoader, solidity } = require("ethereum-waffle");
const { expect, use } = require("chai");
use(solidity);

const {
  aaveLendingPool,
  aaveCore,
  curve,
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
  comp,
  link
} = require("./utils/constants");

describe("LimaSwap", function () {
  let owner, user2, limaSwap, LimaSwapContract;
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
    aaveContract
  // contract enum values
  const NOT_FOUND = 0;
  const COMPOUND = 1;
  const AAVE = 2;
  const STABLE_COIN = 1;
  const INTEREST_TOKEN = 2;

  before(async () => {
    const provider = ethers.provider;
    const signers = await provider.listAccounts();
    loadFixture = createFixtureLoader(signers, provider);

    const [firstUser, secondUser] = await ethers.getSigners();
    owner = await firstUser.getAddress();
    user2 = await secondUser.getAddress();
  });

  beforeEach(async () => {
    await loadFixture(fixture);
  });

  async function fixture() {
    LimaSwapContract = await ethers.getContractFactory("LimaSwap");

    // initialize after proxy deployment
    limaSwap = await upgrades.deployProxy(LimaSwapContract, null, {
      initializer: "initialize",
      unsafeAllowCustomTypes: true,
    });

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

    await linkContract.approve(limaSwap.address, maxUint);
    await aaveContract.approve(limaSwap.address, maxUint);
  }

  describe.skip("#initialize", function () {
    it("sets global variables", async () => {
      expect(await limaSwap.aaveLendingPool()).to.eq(aaveLendingPool);
      expect(await limaSwap.aaveCore()).to.eq(aaveCore);
      expect(await limaSwap.curve()).to.eq(curve);
    });

    it("sets token types", async () => {
      expect(await limaSwap.tokenTypes(dai)).to.eq(STABLE_COIN);
      expect(await limaSwap.tokenTypes(usdc)).to.eq(STABLE_COIN);
      expect(await limaSwap.tokenTypes(usdt)).to.eq(STABLE_COIN);

      expect(await limaSwap.tokenTypes(cDai)).to.eq(INTEREST_TOKEN);
      expect(await limaSwap.tokenTypes(cUsdc)).to.eq(INTEREST_TOKEN);
      expect(await limaSwap.tokenTypes(cUsdt)).to.eq(INTEREST_TOKEN);

      expect(await limaSwap.tokenTypes(aDai)).to.eq(INTEREST_TOKEN);
      expect(await limaSwap.tokenTypes(aUsdc)).to.eq(INTEREST_TOKEN);
      expect(await limaSwap.tokenTypes(aUsdt)).to.eq(INTEREST_TOKEN);
    });

    it("sets interest bearing tokens to lenders", async () => {
      expect(await limaSwap.lenders(cDai)).to.eq(COMPOUND);
      expect(await limaSwap.lenders(cUsdc)).to.eq(COMPOUND);
      expect(await limaSwap.lenders(cUsdt)).to.eq(COMPOUND);

      expect(await limaSwap.lenders(aDai)).to.eq(AAVE);
      expect(await limaSwap.lenders(aUsdc)).to.eq(AAVE);
      expect(await limaSwap.lenders(aUsdt)).to.eq(AAVE);
    });

    it("sets interest tokens to their underlying stable coins", async () => {
      expect(await limaSwap.interestTokenToUnderlyingStablecoin(cDai)).to.eq(
        dai
      );
      expect(await limaSwap.interestTokenToUnderlyingStablecoin(cUsdc)).to.eq(
        usdc
      );
      expect(await limaSwap.interestTokenToUnderlyingStablecoin(cUsdt)).to.eq(
        usdt
      );

      expect(await limaSwap.interestTokenToUnderlyingStablecoin(aDai)).to.eq(
        dai
      );
      expect(await limaSwap.interestTokenToUnderlyingStablecoin(aUsdc)).to.eq(
        usdc
      );
      expect(await limaSwap.interestTokenToUnderlyingStablecoin(aUsdt)).to.eq(
        usdt
      );
    });

    it("approves contract to use tokens infinitely", async () => {
      const maxUint = await limaSwap.MAX_UINT256();

      expect(await daiContract.allowance(limaSwap.address, aaveCore)).to.eq(
        maxUint
      );
      expect(await daiContract.allowance(limaSwap.address, cDai)).to.eq(
        maxUint
      );

      expect(await usdcContract.allowance(limaSwap.address, aaveCore)).to.eq(
        maxUint
      );
      expect(await usdcContract.allowance(limaSwap.address, cUsdc)).to.eq(
        maxUint
      );

      expect(await usdtContract.allowance(limaSwap.address, aaveCore)).to.eq(
        maxUint
      );
      expect(await usdtContract.allowance(limaSwap.address, cUsdt)).to.eq(
        maxUint
      );
    });
  });

  it("gets lender and tokeType via token address", async () => {
    expect((await limaSwap.getTokenInfo(aDai))[0]).to.eq(AAVE);
    expect((await limaSwap.getTokenInfo(aDai))[1]).to.eq(INTEREST_TOKEN);

    expect((await limaSwap.getTokenInfo(usdt))[0]).to.eq(NOT_FOUND);
    expect((await limaSwap.getTokenInfo(usdt))[1]).to.eq(STABLE_COIN);

    expect((await limaSwap.getTokenInfo(cUsdc))[0]).to.eq(COMPOUND);
    expect((await limaSwap.getTokenInfo(cUsdc))[1]).to.eq(INTEREST_TOKEN);
  });

  describe("#setNewAaveLendingPool", function () {
    it("allows only owner is set variable", async () => {
      await expect(limaSwap.connect(user2).setNewAaveLendingPool(aaveCore)).to
        .be.reverted;
    });

    it("doesn't allow the creation of an empty address", async () => {
      await expect(
        limaSwap.setNewAaveLendingPool(
          "0x0000000000000000000000000000000000000000"
        )
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      await limaSwap.setNewAaveLendingPool(aaveCore);
      expect(await limaSwap.aaveLendingPool()).to.eq(aaveCore);
    });
  });

  describe("#setNewAaveCore", function () {
    it("allows only owner is set variable", async () => {
      await expect(limaSwap.connect(user2).setNewAaveCore(aaveLendingPool)).to
        .be.reverted;
    });

    it("doesn't allow the creation of an empty address", async () => {
      await expect(
        limaSwap.setNewAaveCore("0x0000000000000000000000000000000000000000")
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      await limaSwap.setNewAaveCore(aaveLendingPool);
      expect(await limaSwap.aaveCore()).to.eq(aaveLendingPool);
    });
  });

  describe("#setNewCurvePool", function () {
    it("allows only owner is set variable", async () => {
      await expect(limaSwap.connect(user2).setNewCurvePool(aaveLendingPool)).to
        .be.reverted;
    });

    it("doesn't allow the creation of an empty address", async () => {
      await expect(
        limaSwap.setNewCurvePool("0x0000000000000000000000000000000000000000")
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      await limaSwap.setNewCurvePool(aaveLendingPool);
      expect(await limaSwap.curve()).to.eq(aaveLendingPool);
    });
  });

  describe("#setNewOneInch", function () {
    it("allows only owner is set variable", async () => {
      await expect(limaSwap.connect(user2).setNewOneInch(aaveLendingPool)).to
        .be.reverted;
    });

    it("doesn't allow the creation of an empty address", async () => {
      await expect(
        limaSwap.setNewOneInch("0x0000000000000000000000000000000000000000")
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      await limaSwap.setNewOneInch(aaveLendingPool);
      expect(await limaSwap.oneInchPortal()).to.eq(aaveLendingPool);
    });
  });

  describe("#setInterestTokenToUnderlyingStablecoin", function () {
    it("allows only owner is set variable", async () => {
      await expect(
        limaSwap
          .connect(user2)
          .setInterestTokenToUnderlyingStablecoin(cDai, dai)
      ).to.be.reverted;
    });

    it("doesn't allow the creation with an empty address", async () => {
      await expect(
        limaSwap.setInterestTokenToUnderlyingStablecoin(
          "0x0000000000000000000000000000000000000000",
          dai
        )
      ).to.be.reverted;

      await expect(
        limaSwap.setInterestTokenToUnderlyingStablecoin(
          cDai,
          "0x0000000000000000000000000000000000000000"
        )
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      const randomAddress = "0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c";
      await limaSwap.setInterestTokenToUnderlyingStablecoin(
        cDai,
        randomAddress
      );
      expect(await limaSwap.interestTokenToUnderlyingStablecoin(cDai)).to.eq(
        randomAddress
      );
    });
  });

  describe("#setAddressToLender", function () {
    it("allows only owner is set variable", async () => {
      await expect(limaSwap.connect(user2).setAddressToLender(cDai, COMPOUND))
        .to.be.reverted;
    });

    it("doesn't allow the creation with an empty address", async () => {
      await expect(
        limaSwap.setAddressToLender(
          "0x0000000000000000000000000000000000000000",
          COMPOUND
        )
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      const randomAddress = "0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c";
      await limaSwap.setAddressToLender(randomAddress, COMPOUND);
      expect(await limaSwap.lenders(randomAddress)).to.eq(COMPOUND);
    });
  });

  describe("#setAddressTokenType", function () {
    it("allows only owner is set variable", async () => {
      await expect(
        limaSwap.connect(user2).setAddressTokenType(cDai, INTEREST_TOKEN)
      ).to.be.reverted;
    });

    it("doesn't allow the creation with an empty address", async () => {
      await expect(
        limaSwap.setAddressTokenType(
          "0x0000000000000000000000000000000000000000",
          INTEREST_TOKEN
        )
      ).to.be.reverted;
    });

    it("storages new variable", async () => {
      const randomAddress = "0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c";
      await limaSwap.setAddressTokenType(randomAddress, INTEREST_TOKEN);
      expect(await limaSwap.tokenTypes(randomAddress)).to.eq(INTEREST_TOKEN);
    });
  });

  describe("#removeLockedErc20", function () {
    beforeEach(async () => {
      await daiContract.transfer(limaSwap.address, 10);
    })

    it("allows only owner is call function", async () => {
      await expect(
        limaSwap.connect(user2).removeLockedErc20(dai, user2, 10)
      ).to.be.reverted;
    });

    it("removes Erc20 from contract", async () => {
      const currentDaiBalance = await daiContract.balanceOf(user2)
      await limaSwap.removeLockedErc20(dai, user2, 10);
      expect(await daiContract.balanceOf(user2)).to.be.above(currentDaiBalance);
    });
  });

  it("#balanceOfToken: ERC20 balance within LimaSwap", async () => {
    expect(await limaSwap.balanceOfToken(dai)).to.eq(0);
    await daiContract.transfer(limaSwap.address, 15);
    expect(await limaSwap.balanceOfToken(dai)).to.eq(15);
  });

  describe("#swap", function () {
    it("swaps one stable coin to another", async () => {
     // to usdc
      const currentUSDCBalance = await usdcContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, usdc, 1e+14, 0);
      expect(await usdcContract.balanceOf(user2)).to.be.above(
        currentUSDCBalance
      );

      const currentUSDCBalance2 = await usdcContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, usdc, 10, 0);
      expect(await usdcContract.balanceOf(user2)).to.be.above(
        currentUSDCBalance2
      );

      // to usdt
      const currentUSDTBalance = await usdtContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, usdt, 1e+14, 0);
      expect(await usdtContract.balanceOf(user2)).to.be.above(
        currentUSDTBalance
      );

      const currentUSDTBalance2 = await usdtContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, usdt, 10, 0);
      expect(await usdtContract.balanceOf(user2)).to.be.above(
        currentUSDTBalance2
      );

      // to dai
      const currentDAIBalance = await daiContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, dai, 10, 0);
      expect(await daiContract.balanceOf(user2)).to.be.above(
        currentDAIBalance
      );

      const currentDAIBalance2 = await daiContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, dai, 10, 0);
      expect(await daiContract.balanceOf(user2)).to.be.above(
        currentDAIBalance2
      );
    });

    it("swaps stable coin to its equivalent Aave interest bearing token", async () => {
      const currentADAIBalance = await aDaiContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, aDai, 10, 0);
      expect(await aDaiContract.balanceOf(user2)).to.be.above(
        currentADAIBalance
      );

      const currentAUSDCBalance = await aUsdcContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, aUsdc, 10, 0);
      expect(await aUsdcContract.balanceOf(user2)).to.be.above(
        currentAUSDCBalance
      );

      const currentAUSDTBalance = await aUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, aUsdt, 10, 0);
      expect(await aUsdtContract.balanceOf(user2)).to.be.above(
        currentAUSDTBalance
      );
    });

    it("swaps stable coin to its equivalent Compound interest bearing token", async () => {
      const currentCusdcBalance = await cUsdcContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, cUsdc, 10, 0);
      expect(await cUsdcContract.balanceOf(user2)).to.be.above(
        currentCusdcBalance
      );

      const currentCusdtBalance = await cUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, cUsdt, 10, 0);
      expect(await cUsdtContract.balanceOf(user2)).to.be.above(
        currentCusdtBalance
      );

      // to swap dai it needs more zer0s
      const currentCdaiBalance = await cDaiContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, cDai, 1e+12, 0);
      expect(await cDaiContract.balanceOf(user2)).to.be.above(currentCdaiBalance);
    });

    //############### non in-kind swaps ###############//
    it("swaps USDT to cUSDC", async () => {

      const currentCusdcBalance = await cUsdcContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, cUsdc, 10, 0);
      expect(await cUsdcContract.balanceOf(user2)).to.be.above(
        currentCusdcBalance
      );
    });

    it("swaps USDT to cDAI", async () => {
      const currentCdaiBalanceT = await cDaiContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, cDai, 10, 0);
      expect(await cDaiContract.balanceOf(user2)).to.be.above(
        currentCdaiBalanceT
      );
    });

    it("swaps USDC to cUSDT", async () => {
      const currentCusdtBalance = await cUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, cUsdt, 10, 0);
      expect(await cUsdtContract.balanceOf(user2)).to.be.above(
        currentCusdtBalance
      );
    });

    it("swaps USDC to cDAI", async () => {
      const currentCdaiBalance = await cDaiContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, cDai, 10, 0);
      expect(await cDaiContract.balanceOf(user2)).to.be.above(
        currentCdaiBalance
      );

    });

    it("swaps DAI to cUSDC", async () => {
      // // keeps reverting whehn swapping DAI to other stable token
      const currentCusdcBalanceT = await cUsdcContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, cUsdc, 1e+14, 0);
      expect(await cUsdcContract.balanceOf(user2)).to.be.above(
        currentCusdcBalanceT
      );

    });

    it("swaps DAI to cUSDT", async () => {
      const currentCusdtBalanceT = await cUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, cUsdt, 1e+14, 0, { gasLimit: 5000000 });
      expect(await cUsdtContract.balanceOf(user2)).to.be.above(
        currentCusdtBalanceT
      );
    });

    it("swaps USDT to aUSDC", async () => {
      const currentAusdcBalance = await aUsdcContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, aUsdc, 10, 0);
      expect(await aUsdcContract.balanceOf(user2)).to.be.above(
        currentAusdcBalance
      );
    });

    it("swaps USDT to aDAI", async () => {
      const currentAdaiBalanceT = await aDaiContract.balanceOf(user2);
      await limaSwap.swap(user2, usdt, aDai, 10, 0);
      expect(await aDaiContract.balanceOf(user2)).to.be.above(
        currentAdaiBalanceT
      );
    });

    it("swaps USDC to cUSDT", async () => {
      const currentAusdtBalance = await aUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, aUsdt, 10, 0);
      expect(await aUsdtContract.balanceOf(user2)).to.be.above(
        currentAusdtBalance
      );
    });

    it("swaps USDC to aDAI", async () => {
      const currentAdaiBalance = await aDaiContract.balanceOf(user2);
      await limaSwap.swap(user2, usdc, aDai, 10, 0);
      expect(await aDaiContract.balanceOf(user2)).to.be.above(
        currentAdaiBalance
      );
    });

    it("swaps DAI to aUSDC", async () => {
      const currentAusdcBalanceT = await aUsdcContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, aUsdc, 1e+14, 0);
      expect(await aUsdcContract.balanceOf(user2)).to.be.above(
        currentAusdcBalanceT
      );
    });

    it("swaps DAI to aUSDT", async () => {
      const currentAusdtBalanceT = await aUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, dai, aUsdt, 1e+14, 0, { gasLimit: 5000000 });
      expect(await aUsdtContract.balanceOf(user2)).to.be.above(
        currentAusdtBalanceT
      );
    });

    it("swaps cUSDC to USDC", async () => {
      await limaSwap.swap(owner, usdc, cUsdc, 10, 0);

      const currentUsdcBalance = await usdcContract.balanceOf(user2);
      await limaSwap.swap(user2, cUsdc, usdc, 5000, 0);
      expect(await usdcContract.balanceOf(user2)).to.be.above(
        currentUsdcBalance
      );
    });

    it("swaps aUSDC to USDC", async () => {
      await limaSwap.swap(owner, usdc, aUsdc, 10, 0);

      const currentUsdcBalanceT = await usdcContract.balanceOf(user2);
      await limaSwap.swap(user2, aUsdc, usdc, 10, 0);
      expect(await usdcContract.balanceOf(user2)).to.be.above(
        currentUsdcBalanceT
      );
    });

    it("swaps aUSDT to USDT", async () => {
      await limaSwap.swap(owner, usdt, cUsdt, 10, 0);

      const currentUsdtBalance = await usdtContract.balanceOf(user2);
      await limaSwap.swap(user2, cUsdt, usdt, 5000, 0);
      expect(await usdtContract.balanceOf(user2)).to.be.above(
        currentUsdtBalance
      );
    });

    it("swaps aUSDT to USDT", async () => {
      await limaSwap.swap(owner, usdt, aUsdt, 10, 0);

      const currentUsdtBalanceT = await usdtContract.balanceOf(user2);
      await limaSwap.swap(user2, aUsdt, usdt, 10, 0);
      expect(await usdtContract.balanceOf(user2)).to.be.above(
        currentUsdtBalanceT
      );
    });

    it("swaps cDAI to DAI", async () => {
      await limaSwap.swap(owner, dai, cDai, 1e+12, 0);
      const currentDaiBalance = await daiContract.balanceOf(user2);
      await limaSwap.swap(user2, cDai, dai, 100, 0);
      expect(await daiContract.balanceOf(user2)).to.be.above(currentDaiBalance);

    });

    it("swaps aDAI to DAI", async () => {
      await limaSwap.swap(owner, dai, aDai, 10, 0);

      const currentDaiBalanceT = await daiContract.balanceOf(user2);
      await limaSwap.swap(user2, aDai, dai, 10, 0);
      expect(await daiContract.balanceOf(user2)).to.be.above(currentDaiBalanceT);
    });

    it("swaps cUSDC to USDT", async () => {
      await limaSwap.swap(owner, usdc, cUsdc, 10, 0);

      const currentUsdtBalance = await usdtContract.balanceOf(user2);
      await limaSwap.swap(user2, cUsdc, usdt, 20000, 0);
      expect(await usdtContract.balanceOf(user2)).to.be.above(
        currentUsdtBalance
      );
    });

    it("swaps aUSDC to DAI", async () => {
      await limaSwap.swap(owner, usdc, aUsdc, 100000, 0);

      const currentBalance = await daiContract.balanceOf(user2);
      await limaSwap.swap(user2, aUsdc, dai, 100000, 0);
      expect(await daiContract.balanceOf(user2)).to.be.above(
        currentBalance
      );
    });

    it("swaps aUSDT to DAI", async () => {
      await limaSwap.swap(owner, usdt, cUsdt, 10, 0);

      const currentDBalance = await daiContract.balanceOf(user2);
      await limaSwap.swap(user2, cUsdt, dai, 20000, 0);
      expect(await daiContract.balanceOf(user2)).to.be.above(
        currentDBalance
      );
    });

    it("swaps aUSDT to USDC", async () => {
      await limaSwap.swap(owner, usdt, aUsdt, 10, 0);

      const currentUsdcBalanceT = await usdcContract.balanceOf(user2);
      await limaSwap.swap(user2, aUsdt, usdc, 10, 0);
      expect(await usdcContract.balanceOf(user2)).to.be.above(
        currentUsdcBalanceT
      );
    });

    it("swaps aDAI to USDT", async () => {
      await limaSwap.swap(owner, dai, cDai, 1e+14, 0);

      const currentUSDTBalance = await usdtContract.balanceOf(user2);
      await limaSwap.swap(user2, cDai, usdt, 24000, 0);
      expect(await usdtContract.balanceOf(user2)).to.be.above(currentUSDTBalance);

    });

    it("swaps aDAI to USDC", async () => {
      await limaSwap.swap(owner, dai, aDai, 1e+14, 0);

      const currentUSDCBalance = await usdcContract.balanceOf(user2);
      await limaSwap.swap(user2, aDai, usdc, 1e+14, 0);
      expect(await usdcContract.balanceOf(user2)).to.be.above(currentUSDCBalance);
    });

    it.skip("swaps AAVE to aUsdt", async () => {
      const currentAUsdtBalanceT = await aUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, aave, aUsdt, 10, 0);
      expect(await aUsdtContract.balanceOf(user2)).to.be.above(
        currentAUsdtBalanceT
      );
    });

    it.skip("swaps COMP to aUsdt", async () => {
      const currentAUsdtBalanceT = await aUsdtContract.balanceOf(user2);
      await limaSwap.swap(user2, comp, aUsdt, 10, 0);
      expect(await aUsdtContract.balanceOf(user2)).to.be.above(
        currentAUsdtBalanceT
      );
    });
    
    it.skip("swaps aDai to LINK", async () => {
      await limaSwap.swap(owner, dai, aDai, 1e+14, 0);
      const currentLinkBalanceT = await linkContract.balanceOf(user2);
      await limaSwap.swap(user2, aDai, link, 1e+14, 0);
      expect(await linkContract.balanceOf(user2)).to.be.above(
        currentLinkBalanceT
      );
    });
  });

  describe("#unwrap", function () {
    it("can only unwrap an interest bearing token", async () => {
      await expect(
        limaSwap.unwrap(dai, 1e+14, user2)
      ).to.be.revertedWith('not an interest bearing token');
    });

    it("unwraps cDai ", async () => {
      await limaSwap.swap(owner, dai, cDai, 1e+12, 0);
      const currentDaiBalance = await daiContract.balanceOf(user2);
      await limaSwap.unwrap(cDai, 100, user2);
      expect(await daiContract.balanceOf(user2)).to.be.above(currentDaiBalance);
    });

    it("unwraps cUSDC ", async () => {
      await limaSwap.swap(owner, usdc, cUsdc, 10, 0);
      const currentBalance = await usdcContract.balanceOf(user2);
      await limaSwap.unwrap(cUsdc, 5000, user2);
      expect(await usdcContract.balanceOf(user2)).to.be.above(currentBalance);
    });

    it("unwraps cUSDT", async () => {
      await limaSwap.swap(owner, usdt, cUsdt, 10, 0);
      const currentBalance = await usdtContract.balanceOf(user2);
      await limaSwap.unwrap(cUsdt, 5000, user2);
      expect(await usdtContract.balanceOf(user2)).to.be.above(currentBalance);
    });

    it("unwraps aDai", async () => {
      await limaSwap.swap(owner, dai, aDai, 1e+12, 0);
      const currentDaiBalance = await daiContract.balanceOf(user2);
      await limaSwap.unwrap(aDai, 10, user2);
      expect(await daiContract.balanceOf(user2)).to.be.above(currentDaiBalance);
    });

    it("unwraps aUSDC", async () => {
      await limaSwap.swap(owner, usdc, aUsdc, 10, 0);
      const currentBalance = await usdcContract.balanceOf(user2);
      await limaSwap.unwrap(aUsdc, 10, user2);
      expect(await usdcContract.balanceOf(user2)).to.be.above(currentBalance);
    });

    it("unwraps aUSDT", async () => {
      await limaSwap.swap(owner, usdt, aUsdt, 10, 0);
      const currentBalance = await usdtContract.balanceOf(user2);
      await limaSwap.unwrap(aUsdt, 10, user2);
      expect(await usdtContract.balanceOf(user2)).to.be.above(currentBalance);
    });

  });
});
