const { ethers } = require("@nomiclabs/buidler");
const ONE = ethers.BigNumber.from("1");
const ONE_STABLECOIN = 1e6;
const setTokenFactoryAddress = "0xE1Cd722575801fE92EEef2CA23396557F7E3B967";
const setTokenCoreAddress = "0xf55186CC537E7067EA616F2aaE007b4427a120C8";

const yCurveDeposit = "0xbBC81d23Ea2c3ec7e56D39296F0cbB648873a5d3";
const susdCurveDeposit = "0xFCBa3E75865d2d561BE8D220616520c171F12851";
const busdCurveDeposit = "0xb6c057591E073249F2D9D88Ba59a46CFC9B59EdB";
const paxCurveDeposit = "0xA50cCc70b6a011CffDdf45057E39679379187287";
const yusd = "0x5dbcF33D8c2E976c6b560249878e6F1491Bca25c"; // yearn yVault poo
const ycrv = "0xdF5e0e81Dff6FAF3A7e52BA697820c5e32D806A8"; // token received from y curve pool

// stablecoins
const dai = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const usdc = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const usdt = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const tusd = "0x0000000000085d4780B73119b644AE5ecd22b376";
const busd = "0x4Fabb145d64652a948d72533023f6E7A623C7C53";
const susd = "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51";
const pax = "0x8E870D67F660D95d5be530380D0eC0bd388289E1";
const link = "0x514910771AF9Ca656af840dff83E8264EcF986CA";

// interest bearing tokens
const cDai = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";
const cUsdc = "0x39AA39c021dfbaE8faC545936693aC917d5E7563";
const cUsdt = "0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9";
const aDai = "0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d";
const aUsdc = "0x9bA00D6856a4eDF4665BcA2C2309936572473B7E";
const aUsdt = "0x71fc860F7D3A592A4a98740e39dB31d25db65ae8";

// protocols
const aaveLendingPool = "0x398eC7346DcD622eDc5ae82352F02bE94C62d119";
const aaveCore = "0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3";
const curve = "0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51";

module.exports = {
  ONE,
  ONE_STABLECOIN,
  setTokenCoreAddress,
  setTokenFactoryAddress,
  yCurveDeposit,
  susdCurveDeposit,
  busdCurveDeposit,
  paxCurveDeposit,
  yusd,
  ycrv,
  dai,
  usdc,
  usdt,
  tusd,
  busd,
  susd,
  pax,
  link,
  aaveLendingPool,
  aaveCore,
  curve,
  cDai,
  cUsdc,
  cUsdt,
  aDai,
  aUsdc,
  aUsdt
};
