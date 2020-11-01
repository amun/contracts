const { createFixtureLoader, solidity } = require("ethereum-waffle");
const { expect, use } = require("chai");
const fs = require("fs");
const { BigNumber } = require("@ethersproject/bignumber");
const { advanceTime } = require("./utils/time");
const {
  LinkToken: LinkTokenContract,
} = require("@chainlink/contracts/truffle/v0.4/LinkToken");
const {
  Oracle: OracleContract,
} = require("@chainlink/contracts/truffle/v0.6/Oracle");
const {
  initializeChainlinkNode,
} = require("../scripts/deployTestEnvironmentFunctions");
const { spawn } = require("child_process");
use(solidity);

function toUint_8_24_Format(source) {
  const binaryString = source.toString(2);
  const shift =
    BigInt(binaryString.length) > 24n ? BigInt(binaryString.length) - 24n : 0n;
  const bits24 = source >> shift;
  const shiftComplement = "0".repeat(2 - shift.toString(16).length);
  const bitsComplement = "0".repeat(6 - bits24.toString(16).length);
  return `${shiftComplement}${shift.toString(
    16
  )}${bitsComplement}${bits24.toString(16)}`;
}
function packData(address, bigint1, bigint2, bigint3) {
  var numberParam = toUint_8_24_Format(bigint1);
  var secondNumberParam = toUint_8_24_Format(bigint2);
  var thirdNumberParam = toUint_8_24_Format(bigint3);
  return (
    "0x" +
    Buffer.from(
      Uint8Array.from(
        Buffer.from(
          numberParam +
            secondNumberParam +
            thirdNumberParam +
            address.replace("0x", ""),
          "hex"
        )
      )
    ).toString("hex")
  );
}

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
    notUnderlyingToken,
    govToken,
    link,
    oracle,
    limaOracle,
    unwrappedToken,
    TokenHelperContract,
    tokenHelper;
  const zero = "0";
  const one = ethers.utils.parseEther("1");
  const two = ethers.utils.parseEther("2");
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
    amountToSellForLink = 5
  ) => {
    // await advanceTime(provider, 24 * 60 * 60); //24 hours

    // await limaToken.connect(signer2).initRebalance();
    const [
      bestTokenPosition,
      minimumReturn,
      minimumReturnGov,
      minimumReturnLink,
    ] = await tokenHelper.getExpectedReturnRebalance(newToken, 5);

    await tokenHelper.setLink(link.address);
    await tokenHelper.setLimaOracle(await user.getAddress());

    await tokenHelper.setIsRebalancing(true);

    await tokenHelper.setIsOracleDataReturned(false);

    const rebalanceData = packData(
      newToken,
      BigInt(minimumReturn.toString()),
      BigInt(minimumReturnGov.toString()),
      BigInt(amountToSellForLink.toString())
    );

    await token.receiveOracleData(
      ethers.utils.formatBytes32String("fakeId"),
      rebalanceData
    );

    const [
      newToken2,
      minimumReturn2,
      minimumReturnGov2,
      amountToSellForLink2,
      minimumReturnLink2,
      governanceToken2,
    ] = await tokenHelper.getRebalancingData();
    // console.log(
    //   newToken,
    //   minimumReturn.toString(),
    //   minimumReturnGov.toString(),
    //   amountToSellForLink.toString(),
    //   minimumReturnLink.toString()
    // );
    // console.log(
    //   newToken2,
    //   minimumReturn2.toString(),
    //   minimumReturnGov2.toString(),
    //   amountToSellForLink2.toString(),
    //   minimumReturnLink2.toString(),
    //   governanceToken2
    // );
    expect(newToken2).to.be.eq(newToken);

    await limaToken.connect(user).rebalance();
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
    const oracleAddresses = fs
      .readFileSync("./build/addrs.env", "utf-8")
      .split("\n")
      .map((x) => x.split("="))
      .reduce((prev, [key, value]) => ((prev[key] = value), prev), {});
    const jobId = fs.readFileSync("./build/jobs.env", "utf-8").split("=")[1];
    var LimaOracleContract = await ethers.getContractFactory("LimaOracle");
    limaOracle = await LimaOracleContract.deploy(
      oracleAddresses.ORACLE_CONTRACT_ADDRESS,
      oracleAddresses.LINK_CONTRACT_ADDRESS,
      ethers.utils.hexlify(ethers.utils.toUtf8Bytes(jobId))
    );
    oracle = new ethers.Contract(
      oracleAddresses.ORACLE_CONTRACT_ADDRESS,
      OracleContract.abi,
      signer
    );
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
        oracleAddresses.LINK_CONTRACT_ADDRESS,
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

    const linkHolder = "0x98c63b7b319dfbdf3d811530f2ab9dfe4983af9d";
    const signerLink = ethers.provider.getSigner(linkHolder);
    //Duplicate definition of Transfer (Transfer(address,address,uint256,bytes), Transfer(address,address,uint256))
    const linkContract = new ethers.Contract(
      oracleAddresses.LINK_CONTRACT_ADDRESS,
      LinkTokenContract.abi,
      signerLink
    );

    const transferTransaction = await linkContract.populateTransaction.transfer(
      token.address,
      BigNumber.from("10000000000000000000"),
      { gasLimit: 50000, from: linkHolder }
    );
    await signerLink.sendTransaction(transferTransaction);

    await underlyingToken.mint(token.address, five);
    await token.mint(user3, five);

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
    it("prevents frontrunning with minimumReturn when using create", async function () {
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
    beforeEach(async () => {
      console.log("Shutting down chainlink service");
      const stopChainlink = spawn("docker-compose", ["down", "chainlink"]);
      const rmChainlink = spawn("docker-compose", ["rm", "chainlink"]);
      const stopDb = spawn("docker-compose", ["down", "db"]);
      const rmDb = spawn("docker-compose", ["rm", "db"]);
      const startDb = spawn("docker-compose", ["start", "db"]);

      await initializeChainlinkNode(oracle, signer);
    });
    it("should get requested data", async function () {
      let result = new Promise(async (resolve, reject) => {
        const timeout = setTimeout(reject, 10000);
        token.on("ReadyForRebalance", (...data) => {
          clearTimeout(timeout);
          resolve();
        });
      });
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      await token.initRebalance();
      await result;
      expect(await tokenHelper.isRebalancing()).to.be.true;
      expect(await tokenHelper.isOracleDataReturned()).to.be.true;
    });
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

      await token
        .connect(limaOracle)
        .receiveOracleData(
          bestToken,
          minimumReturn,
          minimumReturnGov,
          amountToSellForLink
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
      await underlyingToken.mint(token.address, ethers.utils.parseEther("95"));
      await advanceTime(provider, 24 * 60 * 60); //24 hours

      // tokenHelper.setExecuteRebalanceGas(zero);
      // tokenHelper.setRebalanceGas(zero);
      await rebalance(token, underlyingToken.address, signer);

      await tokenHelper.setPerformanceFee(10); //1/10 = 10%

      await underlyingToken.mint(token.address, ethers.utils.parseEther("100")); //send 100 for 100% increase

      await rebalance(token, underlyingToken.address, signer);
      expect(await unwrappedToken.balanceOf(feeWalletAddress)).to.eq( '9998524764000000000')//ten); should be ten rounding of packing
    });

    it("sell underlying token for link", async function () {
      await rebalance(token, underlyingToken.address, signer, one);
      expect(await link.balanceOf(token.address)).to.eq('1999999968613498880')  // two); SHould be 2 but because of rounding with packing
    });
    it("sells governance token for underlying token", async function () {
      await govToken.mint(token.address, ten);
      expect(await govToken.balanceOf(token.address)).to.eq(ten);

      await rebalance(token, underlyingToken.address, signer, one);
      expect(await govToken.balanceOf(token.address)).to.eq(zero);
    });
    it("prevents non-owners from using rebalance", async function () {
      await expect(rebalance(token, underlyingToken.address, signer2, one)).to
        .be.reverted;
    });

    it("prevents frontrunning with minimumReturn when using rebalance", async function () {
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
        BigInt('5')
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
  describe("initRebalance", function () {
    beforeEach(async () => {
      console.log("Shutting down chainlink service");
      const stopChainlink = spawn("docker-compose", ["down", "chainlink"]);
      const rmChainlink = spawn("docker-compose", ["rm", "chainlink"]);
      const stopDb = spawn("docker-compose", ["down", "db"]);
      const rmDb = spawn("docker-compose", ["rm", "db"]);
      const startDb = spawn("docker-compose", ["start", "db"]);

      await initializeChainlinkNode(oracle, signer);
    });
    it("should get requested data", async function () {
      let result = new Promise(async (resolve, reject) => {
        const timeout = setTimeout(reject, 10000);
        token.on("ReadyForRebalance", (...data) => {
          clearTimeout(timeout);
          resolve();
        });
      });
      await advanceTime(provider, 24 * 60 * 60); //24 hours
      await token.initRebalance();
      await result;
    });
  });
});
