// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import {
    OwnableUpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";

import {
    SafeERC20,
    SafeMath
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import {
    IERC20
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import {
    ReentrancyGuardUpgradeSafe
} from "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";

import {Compound} from "./interfaces/Compound.sol";
import {Aave} from "./interfaces/Aave.sol";
import {AToken} from "./interfaces/AToken.sol";
import {ICurve} from "./interfaces/ICurve.sol";

contract AddressStorage is OwnableUpgradeSafe {
    enum Lender {COMPOUND, AAVE}
    enum TokenType {STABLE_COIN, INTEREST_TOKEN}

    address internal constant dai = address(
        0x6B175474E89094C44Da98b954EedeAC495271d0F
    );
    address internal constant usdc = address(
        0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    );
    address internal constant usdt = address(
        0xdAC17F958D2ee523a2206206994597C13D831ec7
    );

    address public aaveLendingPool;
    address public aaveCore;
    address public curve;

    mapping(address => Lender) internal lenders;
    mapping(address => TokenType) internal tokenTypes;
    mapping(address => address) internal interestTokenToUnderlyingStablecoin;

    function getAddress(address tokenAddress)
        public
        view
        returns (Lender, TokenType)
    {
        return (lenders[tokenAddress], tokenTypes[tokenAddress]);
    }

    function setNewAaveLendingPool(address _newAaveLendingPool)
        public
        onlyOwner
    {
        require(
            _newAaveLendingPool != address(0),
            "new _newAaveLendingPool is empty"
        );
        aaveLendingPool = _newAaveLendingPool;
    }

    function setNewAaveCore(address _newAaveCore) public onlyOwner {
        require(_newAaveCore != address(0), "new _newAaveCore is empty");
        aaveCore = _newAaveCore;
    }

    function setNewCurvePool(address _newCurvePool) public onlyOwner {
        require(_newCurvePool != address(0), "new _newCurvePool is empty");
        curve = _newCurvePool;
    }

    function _setInterestTokenToUnderlyingStablecoin(
        address interestToken,
        address underlyingToken
    ) public onlyOwner {
        interestTokenToUnderlyingStablecoin[interestToken] = underlyingToken;
    }

    function _setAddressToLender(address _token, Lender _lender)
        public
        onlyOwner
    {
        lenders[_token] = _lender;
    }

    function _setAddressTokenType(address _token, TokenType _tokenType)
        public
        onlyOwner
    {
        tokenTypes[_token] = _tokenType;
    }
}

contract LimaSwap is AddressStorage, ReentrancyGuardUpgradeSafe {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant MAX_UINT256 = 2**256 - 1;
    uint16 public constant aaveCode = 94;

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        aaveLendingPool = address(0x398eC7346DcD622eDc5ae82352F02bE94C62d119);
        aaveCore = address(0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3);
        curve = address(0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51); // yPool

        // set stable coins
        _setAddressTokenType(
            0x6B175474E89094C44Da98b954EedeAC495271d0F,
            TokenType.STABLE_COIN
        ); // dai
        _setAddressTokenType(
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            TokenType.STABLE_COIN
        ); // usdc
        _setAddressTokenType(
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            TokenType.STABLE_COIN
        ); // usdt

        // set interest bearing tokens to lenders
        _setAddressToLender(
            0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643,
            Lender.COMPOUND
        ); // compoundDai
        _setAddressToLender(
            0x39AA39c021dfbaE8faC545936693aC917d5E7563,
            Lender.COMPOUND
        ); // compoundUSDC
        _setAddressToLender(
            0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9,
            Lender.COMPOUND
        ); // compoundUSDT

        _setAddressToLender(
            0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d,
            Lender.AAVE
        ); // aaveDai
        _setAddressToLender(
            0x9bA00D6856a4eDF4665BcA2C2309936572473B7E,
            Lender.AAVE
        ); // aaveUSDC
        _setAddressToLender(
            0x71fc860F7D3A592A4a98740e39dB31d25db65ae8,
            Lender.AAVE
        ); // aaveUSDT

        // set interest tokens to their underlying stable coins
        _setInterestTokenToUnderlyingStablecoin(
            0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643,
            dai
        ); //compoundDai
        _setInterestTokenToUnderlyingStablecoin(
            0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d,
            dai
        ); // aaveDai
        _setInterestTokenToUnderlyingStablecoin(
            0x39AA39c021dfbaE8faC545936693aC917d5E7563,
            usdc
        ); //compoundUsdc
        _setInterestTokenToUnderlyingStablecoin(
            0x9bA00D6856a4eDF4665BcA2C2309936572473B7E,
            usdc
        ); //aaveUsdc
        _setInterestTokenToUnderlyingStablecoin(
            0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9,
            usdt
        ); // compoundUsdt
        _setInterestTokenToUnderlyingStablecoin(
            0x71fc860F7D3A592A4a98740e39dB31d25db65ae8,
            usdt
        ); // aaveUsdt

        // infinitely approve tokens
        IERC20(dai).safeApprove(aaveCore, MAX_UINT256);
        IERC20(dai).safeApprove(
            0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643,
            MAX_UINT256
        ); // compoundDai
        IERC20(usdc).safeApprove(aaveCore, MAX_UINT256);
        IERC20(usdc).safeApprove(
            0x39AA39c021dfbaE8faC545936693aC917d5E7563,
            MAX_UINT256
        ); // compoundUSDC
        IERC20(usdt).safeApprove(aaveCore, MAX_UINT256);
        IERC20(usdt).safeApprove(
            0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9,
            MAX_UINT256
        ); // compoundUSDT
    }

    /* ============ Public ============ */

    function getExpectedReturn(
        address fromToken,
        address toToken,
        uint256 amount
    ) public view returns (uint256 returnAmount) {
        (int128 i, int128 j) = calculateCurveSelector(
            IERC20(fromToken),
            IERC20(toToken)
        );

        returnAmount = ICurve(curve).get_dy_underlying(i, j, amount);
    }

    function balanceAaveAvailable(address underlyingStablecoin)
        public
        view
        returns (uint256)
    {
        return IERC20(underlyingStablecoin).balanceOf(aaveCore);
    }

    function balanceAave(address aToken) public view returns (uint256) {
        return IERC20(aToken).balanceOf(address(this));
    }

    function balanceCompound(address cToken) public view returns (uint256) {
        return IERC20(cToken).balanceOf(address(this));
    }

    function balanceCompoundInToken(address cToken)
        public
        view
        returns (uint256)
    {
        uint256 balance = balanceCompound(cToken);
        if (balance > 0) {
            balance = balance.mul(Compound(cToken).exchangeRateStored()).div(
                1e18
            );
        }
        return balance;
    }

    function balanceOfToken(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function swap(
        address recipient,
        address from,
        address to,
        uint256 amount,
        uint256 minReturnAmount
    ) public nonReentrant returns (uint256 returnAmount) {
        address fromTokencalculatedUnderlyingStablecoin;

        // from token calculations
        if (tokenTypes[from] == TokenType.INTEREST_TOKEN) {
            if (lenders[from] == Lender.COMPOUND) {
                _transferAmountToSwap(from, msg.sender, amount);
                _withdrawCompound(from);
            } else if (lenders[from] == Lender.AAVE) {
                _withdrawAave(from);
            }

            fromTokencalculatedUnderlyingStablecoin = interestTokenToUnderlyingStablecoin[from];
        } else if (tokenTypes[from] == TokenType.STABLE_COIN) {
            _transferAmountToSwap(from, msg.sender, amount);
            fromTokencalculatedUnderlyingStablecoin = from;
        } else {
            revert("Token currently unswapable");
        }

        uint256 balanceofSwappedtoken;
        // to token calculations
        if (tokenTypes[to] == TokenType.STABLE_COIN) {
            if (fromTokencalculatedUnderlyingStablecoin == to) {
                balanceofSwappedtoken = balanceOfToken(
                    fromTokencalculatedUnderlyingStablecoin
                );
                IERC20(to).safeTransfer(recipient, balanceofSwappedtoken);
            } else {
                _swapViaCurve(
                    fromTokencalculatedUnderlyingStablecoin,
                    to,
                    minReturnAmount
                );
                balanceofSwappedtoken = balanceOfToken(to);
                IERC20(to).safeTransfer(recipient, balanceofSwappedtoken);
            }
        } else if (tokenTypes[to] == TokenType.INTEREST_TOKEN) {
            address toTokenStablecoin = interestTokenToUnderlyingStablecoin[to];

            if (fromTokencalculatedUnderlyingStablecoin != toTokenStablecoin) {
                _swapViaCurve(
                    fromTokencalculatedUnderlyingStablecoin,
                    toTokenStablecoin,
                    minReturnAmount
                );
                balanceofSwappedtoken = balanceOfToken(toTokenStablecoin);
            }

            if (balanceofSwappedtoken > 0) {
                //the balance may not be the same after warapping
                if (lenders[to] == Lender.COMPOUND) {
                    _supplyCompound(to, balanceofSwappedtoken);
                } else if (lenders[to] == Lender.AAVE) {
                    _supplyAave(to, balanceofSwappedtoken);
                }
            }
            IERC20(to).safeTransfer(recipient, balanceofSwappedtoken);
        }

        return balanceofSwappedtoken;
    }

    /* ============ Internal ============ */
    function _transferAmountToSwap(
        address from,
        address sender,
        uint256 amount
    ) internal {
        IERC20(from).safeTransferFrom(sender, address(this), amount);
    }

    function calculateCurveSelector(IERC20 fromToken, IERC20 toToken)
        internal
        pure
        returns (int128, int128)
    {
        IERC20[] memory tokens = new IERC20[](3);
        tokens[0] = IERC20(dai);
        tokens[1] = IERC20(usdc);
        tokens[2] = IERC20(usdt);

        int128 i = 0;
        int128 j = 0;
        for (uint256 t = 0; t < tokens.length; t++) {
            if (fromToken == tokens[t]) {
                i = int128(t + 1);
            }
            if (toToken == tokens[t]) {
                j = int128(t + 1);
            }
        }

        return (i - 1, j - 1);
    }

    function _swapViaCurve(
        address from,
        address to,
        uint256 minAmountToPreventFrontrunning
    ) internal {
        (int128 i, int128 j) = calculateCurveSelector(IERC20(from), IERC20(to));
        uint256 balanceStabletoken = balanceOfToken(from);

        ICurve(curve).exchange_underlying(
            i,
            j,
            balanceStabletoken,
            minAmountToPreventFrontrunning
        );
    }

    function _supplyCompound(address interestToken, uint256 amount) internal {
        require(
            Compound(interestToken).mint(amount) == 0,
            "COMPOUND: supply failed"
        );
    }

    function _supplyAave(address _underlyingToken, uint256 amount) internal {
        Aave(aaveLendingPool).deposit(_underlyingToken, amount, aaveCode);
    }

    function _withdrawCompound(address from) internal {
        uint256 balance = balanceCompound(from);
        if (balance > 0) {
            uint256 balanceInToken = balanceCompoundInToken(from);
            require(balanceInToken >= balance.sub(1), "Insufficient funds");
            // can have unintentional rounding errors
            uint256 amountInCToken = (balance.mul(balance.sub(1)))
                .div(balanceInToken)
                .add(1);

            require(
                Compound(from).redeem(amountInCToken) == 0,
                "COMPOUND: withdraw failed"
            );
        }
    }

    function _withdrawAave(address from) internal {
        uint256 amount = balanceAave(from);

        if (amount > 0) {
            if (amount > balanceAaveAvailable(from)) {
                amount = balanceAaveAvailable(from);
            }

            AToken(from).redeem(amount);
        }
    }
}
