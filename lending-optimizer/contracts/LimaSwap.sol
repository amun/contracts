// SPDX-License-Identifier: MIT
pragma solidity ^0.6.12;

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

import {
    IUniswapV2Router02
} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {Compound} from "./interfaces/Compound.sol";
import {Aave} from "./interfaces/Aave.sol";
import {AToken} from "./interfaces/AToken.sol";
import {ICurve} from "./interfaces/ICurve.sol";
import {CToken} from "./interfaces/CToken.sol";

contract AddressStorage is OwnableUpgradeSafe {
    enum Lender {NOT_FOUND, COMPOUND, AAVE}
    enum TokenType {NOT_FOUND, STABLE_COIN, INTEREST_TOKEN}

    address internal constant dai = address(
        0x6B175474E89094C44Da98b954EedeAC495271d0F
    );
    address internal constant usdc = address(
        0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    );
    address internal constant usdt = address(
        0xdAC17F958D2ee523a2206206994597C13D831ec7
    );

    //governance token
    address internal constant AAVE = address(
        0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9
    );
    address internal constant COMP = address(
        0xc00e94Cb662C3520282E6f5717214004A7f26888
    );

    address public aaveLendingPool;
    address public aaveCore;
    address public curve;

    mapping(address => Lender) public lenders;
    mapping(address => TokenType) public tokenTypes;
    mapping(address => address) public interestTokenToUnderlyingStablecoin;

    // @dev get ERC20 address for governance token from Compound or AAVE
    // @param _token ERC20 address
    function getGovernanceToken(address token) public view returns (address) {
        if (lenders[token] == Lender.COMPOUND) {
            return COMP;
        } else if (lenders[token] == Lender.AAVE) {
            return AAVE;
        } else {
            return address(0);
        }
    }

    // @dev get interest bearing token information
    // @param _token ERC20 address
    // @return lender protocol (Lender) and TokenTypes enums
    function getTokenInfo(address interestBearingToken)
        public
        view
        returns (Lender, TokenType)
    {
        return (
            lenders[interestBearingToken],
            tokenTypes[interestBearingToken]
        );
    }

    // @dev set new Aave lending pool address
    // @param _newAaveLendingPool Aave lending pool address
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

    // @dev set new Aave core address
    // @param _newAaveCore Aave core address
    function setNewAaveCore(address _newAaveCore) public onlyOwner {
        require(_newAaveCore != address(0), "new _newAaveCore is empty");
        aaveCore = _newAaveCore;
    }

    // @dev set new curve pool
    // @param _newCurvePool Curve pool address
    function setNewCurvePool(address _newCurvePool) public onlyOwner {
        require(_newCurvePool != address(0), "new _newCurvePool is empty");
        curve = _newCurvePool;
    }

    // @dev set interest bearing token to its stable coin underlying
    // @param interestToken ERC20 address
    // @param underlyingToken stable coin ERC20 address
    function setInterestTokenToUnderlyingStablecoin(
        address interestToken,
        address underlyingToken
    ) public onlyOwner {
        require(
            interestToken != address(0) && underlyingToken != address(0),
            "token addresses must be entered"
        );

        interestTokenToUnderlyingStablecoin[interestToken] = underlyingToken;
    }

    // @dev set interest bearing token to a lender protocol
    // @param _token ERC20 address
    // @param _lender Integer which represents LENDER enum
    function setAddressToLender(address _token, Lender _lender)
        public
        onlyOwner
    {
        require(_token != address(0), "!_token");

        lenders[_token] = _lender;
    }

    // @dev set token to its type
    // @param _token ERC20 address
    // @param _tokenType Integer which represents TokenType enum
    function setAddressTokenType(address _token, TokenType _tokenType)
        public
        onlyOwner
    {
        require(_token != address(0), "!_token");

        tokenTypes[_token] = _tokenType;
    }
}

contract LimaSwap is AddressStorage, ReentrancyGuardUpgradeSafe {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    uint256 public constant MAX_UINT256 = 2**256 - 1;
    uint16 public constant aaveCode = 94;

    IUniswapV2Router02 private constant uniswapRouter = IUniswapV2Router02(
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    );

    event Swapped(address from, address to, uint256 amount, uint256 result);

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
        aaveLendingPool = address(0x398eC7346DcD622eDc5ae82352F02bE94C62d119);
        aaveCore = address(0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3);
        curve = address(0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51); // yPool

        address cDai = 0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643;
        address cUsdc = 0x39AA39c021dfbaE8faC545936693aC917d5E7563;
        address cUsdt = 0xf650C3d88D12dB855b8bf7D11Be6C55A4e07dCC9;
        address aDai = 0xfC1E690f61EFd961294b3e1Ce3313fBD8aa4f85d;
        address aUsdc = 0x9bA00D6856a4eDF4665BcA2C2309936572473B7E;
        address aUsdt = 0x71fc860F7D3A592A4a98740e39dB31d25db65ae8;

        // set token types
        setAddressTokenType(dai, TokenType.STABLE_COIN);
        setAddressTokenType(usdc, TokenType.STABLE_COIN);
        setAddressTokenType(usdt, TokenType.STABLE_COIN);

        setAddressTokenType(cDai, TokenType.INTEREST_TOKEN);
        setAddressTokenType(cUsdc, TokenType.INTEREST_TOKEN);
        setAddressTokenType(cUsdt, TokenType.INTEREST_TOKEN);

        setAddressTokenType(aDai, TokenType.INTEREST_TOKEN);
        setAddressTokenType(aUsdc, TokenType.INTEREST_TOKEN);
        setAddressTokenType(aUsdt, TokenType.INTEREST_TOKEN);

        // set interest bearing tokens to lenders
        setAddressToLender(cDai, Lender.COMPOUND); // compoundDai
        setAddressToLender(cUsdc, Lender.COMPOUND); // compoundUSDC
        setAddressToLender(cUsdt, Lender.COMPOUND); // compoundUSDT

        setAddressToLender(aDai, Lender.AAVE); // aaveDai
        setAddressToLender(aUsdc, Lender.AAVE); // aaveUSDC
        setAddressToLender(aUsdt, Lender.AAVE); // aaveUSDT

        // set interest tokens to their underlying stable coins
        setInterestTokenToUnderlyingStablecoin(cDai, dai); //compoundDai
        setInterestTokenToUnderlyingStablecoin(aDai, dai); // aaveDai
        setInterestTokenToUnderlyingStablecoin(cUsdc, usdc); //compoundUsdc
        setInterestTokenToUnderlyingStablecoin(aUsdc, usdc); //aaveUsdc
        setInterestTokenToUnderlyingStablecoin(cUsdt, usdt); // compoundUsdt
        setInterestTokenToUnderlyingStablecoin(aUsdt, usdt); // aaveUsdt

        // infinitely approve tokens
        IERC20(dai).safeApprove(aaveCore, MAX_UINT256);
        IERC20(dai).safeApprove(cDai, MAX_UINT256); // compoundDai
        IERC20(dai).safeApprove(curve, MAX_UINT256); // curve

        IERC20(usdc).safeApprove(aaveCore, MAX_UINT256);
        IERC20(usdc).safeApprove(cUsdc, MAX_UINT256); // compoundUSDC
        IERC20(usdc).safeApprove(curve, MAX_UINT256); // curve

        IERC20(usdt).safeApprove(aaveCore, MAX_UINT256);
        IERC20(usdt).safeApprove(cUsdt, MAX_UINT256); // compoundUSDT
        IERC20(usdt).safeApprove(curve, MAX_UINT256); // curve
    }

    /* ============ Public ============ */

    // @dev used for getting aproximate return amount from exchanging stable coins or interest bearing tokens to usdt usdc or dai
    // used to calculate min return amount
    // @param fromToken from ERC20 address
    // @param toToken destination ERC20 address
    // @param amount Number in fromToken
    function getExpectedReturn(
        address fromToken,
        address toToken,
        uint256 amount
    ) public view returns (uint256 returnAmount) {
        //get unwrapped token or keep if allready unwrapped
        toToken = _normalizeToken(toToken);

        //get unwrapped from token and amount
        if (
            tokenTypes[fromToken] == TokenType.INTEREST_TOKEN &&
            lenders[fromToken] == Lender.COMPOUND
        ) {
            uint256 compoundRate = CToken(fromToken).exchangeRateStored();
            amount = amount.mul(compoundRate).div(1e18);
            fromToken = interestTokenToUnderlyingStablecoin[fromToken];
        } else if (
            tokenTypes[fromToken] == TokenType.INTEREST_TOKEN &&
            lenders[fromToken] == Lender.AAVE
        ) {
            fromToken = interestTokenToUnderlyingStablecoin[fromToken];
        }
        //only wrap or unwrap
        if (toToken == fromToken) {
            return amount;
        }
        if (
            tokenTypes[toToken] == TokenType.NOT_FOUND ||
            tokenTypes[fromToken] == TokenType.NOT_FOUND
        ) {
            //uniswap
            returnAmount = _getExpectedReturnUniswap(
                fromToken,
                toToken,
                amount
            );
        } else {
            //curve
            (int128 i, int128 j) = _calculateCurveSelector(
                IERC20(fromToken),
                IERC20(toToken)
            );
            returnAmount = ICurve(curve).get_dy_underlying(i, j, amount);
        }
        return returnAmount;
    }

    function getUnderlyingAmount(address token, uint256 amount)
        public
        returns (uint256 underlyingAmount)
    {
        underlyingAmount = amount;
        if (
            tokenTypes[token] == TokenType.INTEREST_TOKEN &&
            lenders[token] == Lender.COMPOUND
        ) {
            uint256 compoundRate = CToken(token).exchangeRateStored();
            underlyingAmount = amount.mul(compoundRate).div(1e18);
        }
        return underlyingAmount;
    }

    // @dev Add function to remove locked tokens that may be sent by users accidently to the contract
    // @param token ERC20 address of token
    // @param recipient Beneficiary of the token transfer
    // @param amount Number to tranfer
    function removeLockedErc20(
        address token,
        address recipient,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(recipient, amount);
    }

    // @dev balance of an ERC20 token within swap contract
    // @param token ERC20 token address
    function balanceOfToken(address token) public view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // @dev swap from token A to token B for sender. Receiver of funds needs to be passed. Sender needs to approve LimaSwap to use her tokens
    // @param recipient Beneficiary of the swap tx
    // @param from ERC20 address of token to swap from
    // @param to ERC20 address to swap to
    // @param amount from Token value to swap
    // @param minReturnAmount Minimum amount that needs to be returned. Used to prevent frontrunning
    function swap(
        address recipient,
        address from,
        address to,
        uint256 amount,
        uint256 minReturnAmount
    ) public nonReentrant returns (uint256) {
        _transferAmountToSwap(from, amount);
        uint256 amountToTransfer = balanceOfToken(to);
        address unwrappedFrom = _normalizeToken(from); //unwrapp token to underlying if possible else stay same (aDai => dai, dai => dai, aave => aave)
        uint256 amountToSwap = amount;
        if (unwrappedFrom != from) {
            amountToSwap = balanceOfToken(unwrappedFrom);
            _unwrap(from);
            amountToSwap = balanceOfToken(unwrappedFrom).sub(amountToSwap);
        }
        address unwrappedTo = _normalizeToken(to);

        if (unwrappedFrom != unwrappedTo) {
            // non core swaps
            if (
                tokenTypes[from] == TokenType.NOT_FOUND ||
                tokenTypes[to] == TokenType.NOT_FOUND
            ) {
                _swapViaUniswap(
                    unwrappedFrom,
                    unwrappedTo,
                    amountToSwap,
                    minReturnAmount,
                    address(this)
                );
            } else {
                // core swaps
                _swapViaCurve(
                    unwrappedFrom,
                    unwrappedTo,
                    amountToSwap,
                    minReturnAmount
                );
            }
        }

        if (unwrappedTo != to) {
            _wrap(to);
        }
        amountToTransfer = balanceOfToken(to).sub(amountToTransfer);

        IERC20(to).safeTransfer(recipient, amountToTransfer);

        emit Swapped(from, to, amount, amountToTransfer);

        return amountToTransfer;
    }

    // @dev swap interesting bearing token to its underlying from either AAve or Compound
    // @param interestBearingToken ERC20 address of interest bearing token
    // @param amount Interest bearing token value
    // @param recipient Beneficiary of the tx
    function unwrap(
        address interestBearingToken,
        uint256 amount,
        address recipient
    ) public nonReentrant {
        (, TokenType t) = getTokenInfo(interestBearingToken);
        require(t == TokenType.INTEREST_TOKEN, "not an interest bearing token");
        _transferAmountToSwap(interestBearingToken, amount);

        _unwrap(interestBearingToken);
        address u = interestTokenToUnderlyingStablecoin[interestBearingToken];

        uint256 balanceofSwappedtoken = balanceOfToken(u);
        IERC20(u).safeTransfer(recipient, balanceofSwappedtoken);
    }

    /* ============ Internal ============ */

    function _swapViaCurve(
        address from,
        address to,
        uint256 amount,
        uint256 minAmountToPreventFrontrunning
    ) internal {
        (int128 i, int128 j) = _calculateCurveSelector(
            IERC20(from),
            IERC20(to)
        );

        ICurve(curve).exchange_underlying(
            i,
            j,
            amount,
            minAmountToPreventFrontrunning
        );
    }

    function _swapViaUniswap(
        address from,
        address to,
        uint256 amount,
        uint256 minReturnAmount,
        address recipient
    ) internal {
        IERC20(from).safeIncreaseAllowance(address(uniswapRouter), amount);

        address[] memory path = new address[](3);
        path[0] = from;
        path[1] = uniswapRouter.WETH();
        path[2] = to;
        uniswapRouter.swapExactTokensForTokens(
            amount,
            minReturnAmount,
            path,
            recipient,
            block.timestamp + 300
        );
    }

    function _getExpectedReturnUniswap(
        address from,
        address to,
        uint256 amount
    ) internal view returns (uint256) {
        address[] memory path = new address[](3);
        path[0] = from;
        path[1] = uniswapRouter.WETH();
        path[2] = to;
        uint256[] memory minOuts = uniswapRouter.getAmountsOut(amount, path);
        return minOuts[minOuts.length - 1];
    }

    function _normalizeToken(address token) internal view returns (address) {
        if (interestTokenToUnderlyingStablecoin[token] == address(0)) {
            return token;
        }
        return interestTokenToUnderlyingStablecoin[token];
    }

    function _wrap(address interestBearingToken) internal {

            address toTokenStablecoin
         = interestTokenToUnderlyingStablecoin[interestBearingToken];
        require(
            toTokenStablecoin != address(0),
            "not an interest bearing token"
        );
        uint256 balanceToTokenStableCoin = balanceOfToken(toTokenStablecoin);
        if (balanceToTokenStableCoin > 0) {
            if (lenders[interestBearingToken] == Lender.COMPOUND) {
                _supplyCompound(interestBearingToken, balanceToTokenStableCoin);
            } else if (lenders[interestBearingToken] == Lender.AAVE) {
                _supplyAave(toTokenStablecoin, balanceToTokenStableCoin);
            }
        }
    }

    function _unwrap(address interestBearingToken) internal {
        (Lender l, TokenType t) = getTokenInfo(interestBearingToken);
        if (t == TokenType.INTEREST_TOKEN) {
            if (l == Lender.COMPOUND) {
                _withdrawCompound(interestBearingToken);
            } else if (l == Lender.AAVE) {
                _withdrawAave(interestBearingToken);
            }
        }
    }

    function _transferAmountToSwap(address from, uint256 amount) internal {
        IERC20(from).safeTransferFrom(msg.sender, address(this), amount);
    }

    // curve interface functions
    function _calculateCurveSelector(IERC20 fromToken, IERC20 toToken)
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
            if (address(fromToken) == address(tokens[t])) {
                i = int128(t + 1);
            }
            if (address(toToken) == address(tokens[t])) {
                j = int128(t + 1);
            }
        }

        return (i - 1, j - 1);
    }

    // compound interface functions
    function _supplyCompound(address interestToken, uint256 amount) internal {
        require(
            Compound(interestToken).mint(amount) == 0,
            "COMPOUND: supply failed"
        );
    }

    function _withdrawCompound(address cToken) internal {
        uint256 balanceInCToken = IERC20(cToken).balanceOf(address(this));
        if (balanceInCToken > 0) {
            require(
                Compound(cToken).redeem(balanceInCToken) == 0,
                "COMPOUND: withdraw failed"
            );
        }
    }

    // aave interface functions
    function _supplyAave(address _underlyingToken, uint256 amount) internal {
        Aave(aaveLendingPool).deposit(_underlyingToken, amount, aaveCode);
    }

    function _withdrawAave(address aToken) internal {
        uint256 amount = IERC20(aToken).balanceOf(address(this));

        if (amount > 0) {
            AToken(aToken).redeem(amount);
        }
    }
}
