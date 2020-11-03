const { createFixtureLoader, solidity } = require("ethereum-waffle");
const { expect, use } = require("chai");
const { BigNumber } = require("@ethersproject/bignumber");

const { advanceTime } = require("./utils/time");
const { packData } = require("./utils/packData");
use(solidity);

describe("LimaToken", function () {
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
    limaOracle,
    unwrappedToken,
    TokenHelperContract,
    tokenHelper;
  const zero = "0";
  const one = ethers.utils.parseEther("1");
  const four = ethers.utils.parseEther("4");
  const five = ethers.utils.parseEther("5");
  const ten = ethers.utils.parseEther("10");

  const create = async (limaToken, investmentToken, amount, user) => {
    const minimumReturn = await tokenHelper.getExpectedReturnCreate(
      investmentToken,
      amount
    );
    await limaToken
      .connect(user)
      .create(investmentToken, amount, await user.getAddress(), minimumReturn);
  };
  const redeem = async (limaToken, investmentToken, amount, user) => {
    const minimumReturn = await tokenHelper.getExpectedReturnRedeem(
      investmentToken,
      amount
    );
    await limaToken
      .connect(user)
      .redeem(investmentToken, amount, await user.getAddress(), minimumReturn);
  };
  const forceRedeem = async (
    limaToken,
    investmentToken,
    amount,
    owner,
    user
  ) => {
    const currentUnderlyingToken = await tokenHelper.currentUnderlyingToken();
    const balancePerToken = await limaToken.getUnderlyingTokenBalanceOf(amount);

    const minimumReturn = await fakeLimaSwap.getExpectedReturn(
      currentUnderlyingToken,
      investmentToken,
      balancePerToken
    );

    await limaToken
      .connect(owner)
      .forceRedeem(
        investmentToken,
        amount,
        await user.getAddress(),
        minimumReturn
      );
  };
  const rebalance = async (
    limaToken,
    newToken,
    user,
    amountToSellForLink = 0
  ) => {
    await advanceTime(provider, 24 * 60 * 60); //24 hours

    await limaToken.connect(signer2).initRebalance();

    const minimumReturn = 0;
    //todo test with gov on token
    const minimumReturnGov = 0;
    //todo test with real link
    const rebalanceData = packData(
      newToken,
      BigInt(minimumReturn.toString()),
      BigInt(minimumReturnGov.toString()),
      BigInt(amountToSellForLink.toString())
    );

    //calls limatoken receiveOracleData
    await limaOracle.fakeCallToReceiveOracleData(
      limaToken.address,
      rebalanceData
    );
    const [
      newToken2,
      minimumReturn2,
      minimumReturnGov2,
      amountToSellForLink2,
    ] = await tokenHelper.getRebalancingData();

    expect(newToken2).to.be.eq(newToken);
    const isWithin = (a, b) => {
      if (BigNumber.from(a).eq(0)) {
        expect(b).to.be.eq(a);
      } else {
        console.log(BigNumber.from(a).mul(96).div(100).toString())
        expect(BigNumber.from(b).gte(BigNumber.from(a).mul(96).div(100))).to.be
          .true;

        expect(BigNumber.from(b).lte(BigNumber.from(a).mul(104).div(100))).to.be
          .true;
      }
    };

    isWithin(minimumReturn, minimumReturn2);
    isWithin(minimumReturnGov, minimumReturnGov2);
    isWithin(amountToSellForLink, amountToSellForLink2);

    await limaToken.connect(user).rebalance();

    expect(await tokenHelper.isRebalancing()).to.be.false;
    expect(await tokenHelper.isOracleDataReturned()).to.be.false;
    expect(await tokenHelper.currentUnderlyingToken()).to.be.eq(newToken);
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
    const OracleContract = await ethers.getContractFactory("FakeOracle");
    limaOracle = await upgrades.deployProxy(OracleContract);

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
    govToken = await upgrades.deployProxy(
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

    await underlyingToken.mint(token.address, five);
    await token.mint(user3, five);
    await link.mint(token.address, five);

    await tokenHelper.switchIsOnlyAmunUser();

    await tokenHelper.addInvestmentToken(underlyingToken.address);
    await tokenHelper.addInvestmentToken(underlyingToken2.address);
    await tokenHelper.addInvestmentToken(underlyingToken3.address);
  }

  describe("#initialize", function () {
    it("is initialized with name and symbol", async function () {
      expect(await token.name()).to.eq("LIMA Token");
      expect(await token.symbol()).to.eq("LTK");
    });

    it("is initialized unpaused", async function () {
      expect(await token.paused()).to.be.false;
    });

    it.skip("adds token LimaManager", async function () {
      expect(await tokenHelper.limaManager()).to.eq(manager.address);
    });

    it("adds token LimaSwap", async function () {
      expect(await tokenHelper.limaSwap()).to.eq(fakeLimaSwap.address);
    });
  });

  describe("View functions", function () {
    it("getUnderlyingTokenBalance()", async function () {
      const underlyingTokenBalance = await token.getUnderlyingTokenBalance();
      expect(underlyingTokenBalance).to.be.eq(five);
    });
    it("getUnderlyingTokenBalanceOf(1)", async function () {
      let underlyingTokenBalance = await token.getUnderlyingTokenBalanceOf(one);
      expect(underlyingTokenBalance).to.be.eq(one);
      const decimalNumber = ethers.utils.parseEther("0.2");

      await underlyingToken.mint(token.address, decimalNumber);

      underlyingTokenBalance = await token.getUnderlyingTokenBalance();
      expect(underlyingTokenBalance).to.be.eq(ethers.utils.parseEther("5.2"));

      const totalSupply = await token.totalSupply();
      let underlyingTokenBalance2 = await token.getUnderlyingTokenBalanceOf(
        totalSupply.div(2)
      );
      expect(underlyingTokenBalance2).to.be.eq(ethers.utils.parseEther("2.6"));
    });
  });

  describe("#mint", function () {
    it("mints tokens for a user", async function () {
      await token.mint(user2, five);
      expect(await token.balanceOf(user2)).to.eq(five);
    });

    it("prevents non-owners from minting tokens", async function () {
      await expect(token.connect(signer2).mint(user2, five)).to.be.reverted;
    });
  });

  describe("Pausable token", function () {
    it("pauses token", async function () {
      await token.pause();
      expect(await token.paused()).to.be.true;
    });

    it("unpauses token when it is paused", async function () {
      await token.pause();
      expect(await token.paused()).to.be.true;

      await token.unpause();
      expect(await token.paused()).to.be.false;
    });

    it("prevents non-owners from pausing token", async function () {
      await expect(token.connect(signer2).pause()).to.be.reverted;
    });
  });

  describe("#create", function () {
    it("mints lima token from investment token", async function () {
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        one
      );
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);

      const balanceOfUserBefore = await underlyingToken2.balanceOf(user2);

      await create(token, underlyingToken2.address, five, signer2);
      const balanceOfUserAfter = await underlyingToken2.balanceOf(user2);
      expect(balanceOfUserBefore.sub(five)).to.eq(balanceOfUserAfter);

      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(one);

      expect(await token.balanceOf(user2)).to.eq(ten);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });
    it("mints lima token from investment token kind token", async function () {
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        one
      );
      await underlyingToken.mint(user2, five);
      await underlyingToken.connect(signer2).approve(token.address, five);

      const balanceOfUserBefore = await underlyingToken.balanceOf(user2);

      await create(token, underlyingToken.address, five, signer2);
      const balanceOfUserAfter = await underlyingToken.balanceOf(user2);
      expect(balanceOfUserBefore.sub(five)).to.eq(balanceOfUserAfter);
      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(one);

      expect(await token.balanceOf(user2)).to.eq(five);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });
    it("revert on create when no amun user", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);

      await tokenHelper.switchIsOnlyAmunUser();

      await expect(create(token, underlyingToken2.address, five, signer2)).to.be
        .reverted;
    });
    it("mints lima token with amun user", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);
      await tokenHelper.switchIsOnlyAmunUser();
      await tokenHelper.addAmunUser(user2);

      await create(token, underlyingToken2.address, five, signer2);
      expect(await token.balanceOf(user2)).to.eq(ten);
    });
    it("mints lima token and sends 20% fee in investment token", async function () {
      await tokenHelper.setMintFee(5); //20%

      await underlyingToken.mint(user2, five);
      await underlyingToken.connect(signer2).approve(token.address, five);

      await create(token, underlyingToken.address, five, signer2);

      expect(await underlyingToken.balanceOf(feeWalletAddress)).to.eq(one);
      expect(await underlyingToken.balanceOf(user2)).to.eq(zero);

      expect(await token.balanceOf(user2)).to.eq(four);
    });
    it("revert on to big minimum return", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);
      const minimumReturn = await tokenHelper.getExpectedReturnCreate(
        underlyingToken2.address,
        five
      );
      await expect(
        token
          .connect(user)
          .create(underlyingToken2.address, five, user2, minimumReturn.add(1))
      ).to.be.reverted;
    });
    it.skip("prevents frontrunning with minimumReturn when using create", async function () {
      await underlyingToken2.mint(user, five);
      await underlyingToken2.approve(token.address, five);
      const amount = one;
      const minimumReturn = await tokenHelper.getExpectedReturnCreate(
        underlyingToken2.address,
        amount
      );
      const minimumReturnToBig = minimumReturn.add(1);
      await expect(
        token
          .connect(signer)
          .create(underlyingToken2.address, amount, user, minimumReturnToBig)
      ).to.be.reverted;
    });
  });

  describe("#redeem", function () {
    it("burns user lima token and pays out in payout token", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);
      await create(token, underlyingToken2.address, five, signer2);

      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        one
      );

      await redeem(token, underlyingToken2.address, five, signer2);
      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(one);

      expect(await token.balanceOf(user2)).to.eq(five);

      expect(await underlyingToken2.balanceOf(user2)).to.eq(ten);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
      expect(await underlyingToken.balanceOf(feeWalletAddress)).to.eq(0);
    });

    it("burns user lima token and pays out in kind", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);

      await create(token, underlyingToken2.address, five, signer2);
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        one
      );

      await redeem(token, underlyingToken.address, five, signer2);
      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(one);

      expect(await token.balanceOf(user2)).to.eq(five);
      expect(await underlyingToken.balanceOf(user2)).to.eq(five);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });

    it("burn lima token and sends 20% fee in unwrapped token", async function () {
      await tokenHelper.setBurnFee(5); //20%

      await underlyingToken.mint(user2, five);
      await underlyingToken.connect(signer2).approve(token.address, five);
      await create(token, underlyingToken.address, five, signer2);

      await redeem(token, underlyingToken.address, five, signer2);

      expect(await unwrappedToken.balanceOf(feeWalletAddress)).to.eq(one);
      expect(await underlyingToken.balanceOf(user2)).to.eq(four);

      expect(await token.balanceOf(user2)).to.eq(zero);
    });
    it("prevents frontrunning with minimumReturn when using redeem", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);

      await create(token, underlyingToken2.address, five, signer2);
      const amount = one;
      const minimumReturn = await tokenHelper.getExpectedReturnRedeem(
        underlyingToken2.address,
        amount
      );
      const minimumReturnToBig = minimumReturn.add(1);
      await expect(
        token
          .connect(signer2)
          .redeem(underlyingToken2.address, amount, user2, minimumReturnToBig)
      ).to.be.reverted;
    });
  });

  describe("#forceRedeem", function () {
    it("burns user lima token and pays out in payout token by owner", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);

      await create(token, underlyingToken2.address, five, signer2);
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        one
      );

      await forceRedeem(token, underlyingToken2.address, five, signer, signer2);
      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(one);

      expect(await token.balanceOf(user2)).to.eq(five);
      expect(await underlyingToken2.balanceOf(user2)).to.eq(ten);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });

    it("burns user lima token and pays out in kind by owner", async function () {
      await underlyingToken2.mint(user2, five);
      await underlyingToken2.connect(signer2).approve(token.address, five);

      await create(token, underlyingToken2.address, five, signer2);
      const balancePerTokenBefore = await token.getUnderlyingTokenBalanceOf(
        one
      );
      await forceRedeem(token, underlyingToken.address, five, signer, signer2);
      const balancePerTokenAfter = await token.getUnderlyingTokenBalanceOf(one);

      expect(await token.balanceOf(user2)).to.eq(five);
      expect(await underlyingToken.balanceOf(user2)).to.eq(five);
      expect(balancePerTokenBefore).to.eq(balancePerTokenAfter);
    });
    it("prevents non-owners from using forceRedeem", async function () {
      await expect(
        token
          .connect(signer2)
          .forceRedeem(underlyingToken.address, one, user, one)
      ).to.be.reverted;
    });
  });

  describe("#initRebalance", function () {
    it("reverts before 24 hours", async function () {
      await expect(token.connect(signer2).initRebalance()).to.be.reverted;
    });
    it("works after 24 hours", async function () {
      await advanceTime(provider, 24 * 60 * 60); //24 hours

      await token.connect(signer2).initRebalance(); //first works
      await expect(token.connect(signer2).initRebalance()).to.be.reverted; //second reverts
    });
    it("payback to user works", async function () {
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      await token.connect(signer2).initRebalance();
      expect(await token.balanceOf(user2)).to.be.gt(zero);
      expect(await tokenHelper.isRebalancing()).to.be.true;
      expect(await tokenHelper.isOracleDataReturned()).to.be.false;
    });
  });

  describe("#receiveOracleData", function () {
    it.skip("works after init rebalance", async function () {
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      const [
        bestToken,
        minimumReturn,
        minimumReturnGov,
        amountToSellForLink,
      ] = await tokenHelper.getExpectedReturnRebalance(
        underlyingToken2.address,
        5
      );

      await token.connect(signer2).initRebalance();
      expect(await tokenHelper.isRebalancing()).to.be.true;
      expect(await tokenHelper.isOracleDataReturned()).to.be.false;
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

      expect(await tokenHelper.isRebalancing()).to.be.true;
      expect(await tokenHelper.isOracleDataReturned()).to.be.true;
    });
    it.skip("prevents calling setRebalance WITHOUT initRebalance", async function () {
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      const [
        bestToken,
        minimumReturn,
        minimumReturnGov,
        amountToSellForLink,
      ] = await tokenHelper.getExpectedReturnRebalance(
        underlyingToken2.address,
        5
      );
      await expect(
        token
          .connect(signer2)
          .receiveOracleData(
            bestToken,
            minimumReturn,
            minimumReturnGov,
            amountToSellForLink
          )
      ).to.be.reverted;
    });
  });

  describe("#rebalance", function () {
    it("move all underlying token to new best token", async function () {
      expect(await tokenHelper.currentUnderlyingToken()).to.not.eq(
        underlyingToken3.address
      );
      expect(await underlyingToken.balanceOf(token.address)).to.not.eq(zero);
      expect(await underlyingToken3.balanceOf(token.address)).to.eq(zero);

      await rebalance(token, underlyingToken3.address, signer);

      expect(await tokenHelper.currentUnderlyingToken()).to.eq(
        underlyingToken3.address
      );
      expect(await underlyingToken.balanceOf(token.address)).to.eq(0);
      expect(await underlyingToken3.balanceOf(token.address)).to.not.eq(0);
    });

    it("stay same token with no change", async function () {
      expect(await tokenHelper.currentUnderlyingToken()).to.eq(
        underlyingToken.address
      );
      expect(await underlyingToken.balanceOf(token.address)).to.not.eq(zero);

      await rebalance(token, underlyingToken.address, signer);

      expect(await tokenHelper.currentUnderlyingToken()).to.eq(
        underlyingToken.address
      );
      expect(await underlyingToken.balanceOf(token.address)).to.not.eq(0);
    });
    it("gives 10% performance fee", async function () {
      await token.mint(user3, five); //10 token
      await underlyingToken.mint(token.address, ethers.utils.parseEther("95"));
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      await rebalance(token, underlyingToken.address, signer);

      await tokenHelper.setPerformanceFee(10); //1/10 = 10%
      await underlyingToken.mint(token.address, ethers.utils.parseEther("100")); //send 100 for 100% increase
      await rebalance(token, underlyingToken.address, signer);
     
      expect(await unwrappedToken.balanceOf(feeWalletAddress)).to.above(
        ethers.utils.parseEther("9.99")
      ); //ten); should be ten minus some payback
    });

    it("sell underlying token for link", async function () {
      await rebalance(token, underlyingToken.address, signer, five);
      expect(await link.balanceOf(token.address)).to.above(ten);
    });

    it("sells governance token for underlying token", async function () {
      await govToken.mint(token.address, ten);
      expect(await govToken.balanceOf(token.address)).to.eq(ten);

      await rebalance(token, underlyingToken.address, signer);
      expect(await govToken.balanceOf(token.address)).to.eq(zero);
    });

    it.skip("prevents frontrunning with minimumReturn when using rebalance", async function () {
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      const newToken = underlyingToken.address;
      await tokenHelper.setLink(link.address);
      await tokenHelper.setLimaOracle(user);

      await tokenHelper.setIsRebalancing(true);

      await tokenHelper.setIsOracleDataReturned(false);
      const [
        bestTokenPosition,
        minimumReturn,
        minimumReturnGov,
        minimumReturnLink,
      ] = await tokenHelper.getExpectedReturnRebalance(
        underlyingToken.address,
        5
      );
      const rebalanceData = packData(
        newToken,
        BigInt(minimumReturn.toString()),
        BigInt(minimumReturnGov.toString()),
        BigInt("5")
      );

      await token.receiveOracleData(
        ethers.utils.formatBytes32String("fakeId"),
        rebalanceData
      );

      await expect(token.connect(signer2).rebalance()).to.be.reverted;
    });
  });
  describe("contract upgrade", function () {
    it("is able to upgrade contract", async function () {
      const TokenContractV2 = await ethers.getContractFactory("LimaTokenV2");
      const tokenV2 = await upgrades.upgradeProxy(
        token.address,
        TokenContractV2
      );

      expect(await tokenV2.name()).to.eq("LIMA Token");
      expect(await tokenV2.symbol()).to.eq("LTK");
      expect(await tokenV2.newFunction()).to.eq(1);
    });
  });
});
