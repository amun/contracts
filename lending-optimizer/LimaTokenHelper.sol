pragma solidity ^0.6.2;

import {
    ERC20PausableUpgradeSafe,
    IERC20,
    SafeMath
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import {AddressArrayUtils} from "./library/AddressArrayUtils.sol";

import {ILimaSwap} from "./interfaces/ILimaSwap.sol";
import {ILimaToken} from "./interfaces/ILimaToken.sol";
import {LimaTokenStorage} from "./LimaTokenStorage.sol";
import {AmunUsers} from "./limaTokenModules/AmunUsers.sol";
import {InvestmentToken} from "./limaTokenModules/InvestmentToken.sol";

/**
 * @title LimaToken
 * @author Lima Protocol
 *
 * Standard LimaToken.
 */
contract LimaTokenHelper is LimaTokenStorage, InvestmentToken, AmunUsers {
    using AddressArrayUtils for address[];
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function initialize(
        address _limaSwap,
        address _feeWallet,
        address _currentUnderlyingToken,
        address[] memory _underlyingTokens,
        uint256 _mintFee,
        uint256 _burnFee,
        uint256 _performanceFee,
        address _link,
        address _oracle
    ) public initializer {
        __LimaTokenStorage_init_unchained(
            _limaSwap,
            _feeWallet,
            _currentUnderlyingToken,
            _underlyingTokens,
            _mintFee,
            _burnFee,
            _performanceFee,
            _link,
            _oracle
        );
        __AmunUsers_init_unchained(true);
    }

    /* ============ View ============ */

    /**
     * @dev Get total net token value.
     */
    function getNetTokenValue(address _targetToken)
        public
        view
        returns (uint256 netTokenValue)
    {
        return
            getExpectedReturn(
                currentUnderlyingToken,
                _targetToken,
                getUnderlyingTokenBalance()
            );
    }

    /**
     * @dev Get total net token value.
     */
    function getNetTokenValueOf(address _targetToken, uint256 _amount)
        public
        view
        returns (uint256 netTokenValue)
    {
        return
            getExpectedReturn(
                currentUnderlyingToken,
                _targetToken,
                getUnderlyingTokenBalanceOf(_amount)
            );
    }

    //helper for redirect to LimaSwap
    function getExpectedReturn(
        address _from,
        address _to,
        uint256 _amount
    ) public view returns (uint256 returnAmount) {
        returnAmount = limaSwap.getExpectedReturn(_from, _to, _amount);
    }

    function getUnderlyingTokenBalance() public view returns (uint256 balance) {
        return IERC20(currentUnderlyingToken).balanceOf(limaToken);
    }

    function getUnderlyingTokenBalanceOf(uint256 _amount)
        public
        view
        returns (uint256 balanceOf)
    {
        uint256 balance = getUnderlyingTokenBalance();
        require(balance != 0, "LM4"); //"Balance of underlyng token cant be zero."
        return balance.mul(_amount).div(ILimaToken(limaToken).totalSupply());
    }

    /* ============ Helper Main Functions ============ */
    function _getPayback(uint256 gas) internal view returns (uint256) {
        //send gas cost
        uint256 gasPayback = (gas + payoutGas).mul(tx.gasprice) +
            rebalanceBonus;
// 0x922018674c12a7F0D394ebEEf9B58F186CdE13c1.price('ETH');
        uint256 returnAmount = limaSwap.getExpectedReturn(
            USDC,
            currentUnderlyingToken,
            gasPayback
        );

        return
            returnAmount.mul(ILimaToken(limaToken).totalSupply()).div(
                ILimaToken(limaToken).getUnderlyingTokenBalance()
            );
    }

    /**
     * @dev Return the amount to payback on execute rebalance
     */
    function getPayback(uint256 gas) external view returns (uint256) {
        return _getPayback(gas);
    }

    function getPerformanceFee()
        external
        view
        returns (uint256 performanceFeeToWallet)
    {
        performanceFeeToWallet = 0;
        if (
            ILimaToken(limaToken).getUnderlyingTokenBalanceOf(1000 ether) >
            lastUnderlyingBalancePer1000 &&
            performanceFee != 0
        ) {
            performanceFeeToWallet = (
                ILimaToken(limaToken).getUnderlyingTokenBalance().sub(
                    ILimaToken(limaToken)
                        .totalSupply()
                        .mul(lastUnderlyingBalancePer1000)
                        .div(1000 ether)
                )
            )
                .div(performanceFee);
        }
    }

    /* ============ User ============ */

    function getFee(uint256 _amount, uint256 _fee)
        public
        pure
        returns (uint256 feeAmount)
    {
        //get fee
        if (_fee > 0) {
            return _amount.div(_fee);
        }
        return 0;
    }

    /**
     * @dev Gets the expecterd return of a redeem
     */
    function getExpectedReturnRedeem(address _to, uint256 _amount)
        external
        view
        returns (uint256 minimumReturn)
    {
        _amount = getUnderlyingTokenBalanceOf(_amount);

        _amount = _amount.sub(getFee(_amount, burnFee));

        return getExpectedReturn(currentUnderlyingToken, _to, _amount);
    }

    /**
     * @dev Gets the expecterd return of a create
     */
    function getExpectedReturnCreate(address _from, uint256 _amount)
        external
        view
        returns (uint256 minimumReturn)
    {
        _amount = _amount.sub(getFee(_amount, mintFee));
        return getExpectedReturn(_from, currentUnderlyingToken, _amount);
    }

    /**
     * @dev Gets the expecterd returns of a rebalance
     */
    function getExpectedReturnRebalance(
        address _bestToken,
        uint256 _amountToSellForLink
    )
        external
        view
        returns (
            uint256 tokenPosition,
            uint256 minimumReturn,
            uint256 minimumReturnGov,
            uint256 minimumReturnLink
        )
    {
        address _govToken = limaSwap.getGovernanceToken(currentUnderlyingToken);
        bool isInUnderlying;
        (tokenPosition, isInUnderlying) = underlyingTokens.indexOf(_bestToken);
        require(isInUnderlying, "LH1");
        minimumReturnLink = getExpectedReturn(
            currentUnderlyingToken,
            LINK,
            _amountToSellForLink
        );

        minimumReturnGov = getExpectedReturn(
            _govToken,
            _bestToken,
            IERC20(_govToken).balanceOf(limaToken)
        );

        minimumReturn = getExpectedReturn(
            currentUnderlyingToken,
            _bestToken,
            IERC20(currentUnderlyingToken).balanceOf(limaToken).sub(
                _amountToSellForLink
            )
        );

        return (
            tokenPosition,
            minimumReturn,
            minimumReturnGov,
            minimumReturnLink
        );
    }

    /* ============ Oracle ============ */

    function decipherNumber(uint32 data) internal pure returns (uint256) {
        uint8 shift = uint8(data >> 24);
        return uint256(data & 0x00FF_FFFF) << shift;
    }

    function decodeOracleData(bytes32 _data)
        public
        pure
        returns (
            address addr,
            uint256 a,
            uint256 b,
            uint256 c
        )
    {
        a = decipherNumber(uint32(uint256(_data) >> (256 - 32)));
        b = decipherNumber(uint32(uint256(_data) >> (256 - 64)));
        c = decipherNumber(uint32(uint256(_data) >> (256 - 96)));
        addr = address(
            uint160((uint256(_data) << (256 - 20 * 8)) >> (256 - 20 * 8))
        );
        return (addr, a, b, c);
    }

    function getRebalancingData()
        external
        view
        returns (
            address newtoken,
            uint256 minimumReturn,
            uint256 minimumReturnGov,
            uint256 amountToSellForLink,
            uint256 _minimumReturnLink,
            address governanceToken
        )
    {
        (
            newtoken,
            minimumReturn,
            minimumReturnGov,
            amountToSellForLink
        ) = decodeOracleData(oracleData);
        return (
            newtoken,
            minimumReturn,
            minimumReturnGov,
            amountToSellForLink,
            minimumReturnLink,
            limaSwap.getGovernanceToken(currentUnderlyingToken)
        );
    }
}