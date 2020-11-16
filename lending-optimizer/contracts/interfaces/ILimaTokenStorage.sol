pragma solidity ^0.6.12;

import {ILimaSwap} from "./ILimaSwap.sol";
import {ILimaOracle} from "./ILimaOracle.sol";

/**
 * @title LimaToken
 * @author Lima Protocol
 *
 * Standard LimaToken.
 */
interface ILimaTokenStorage {
    function MAX_UINT256() external view returns (uint256);

    function WETH() external view returns (address);

    function LINK() external view returns (address);

    function currentUnderlyingToken() external view returns (address);

    // address external owner;
    function limaSwap() external view returns (ILimaSwap);

    function rebalanceBonus() external view returns (uint256);

    function rebalanceGas() external view returns (uint256);

    //Fees
    function feeWallet() external view returns (address);

    function burnFee() external view returns (uint256);

    function mintFee() external view returns (uint256);

    function performanceFee() external view returns (uint256);

    function requestId() external view returns (bytes32);

    //Rebalance
    function lastUnderlyingBalancePer1000() external view returns (uint256);

    function lastRebalance() external view returns (uint256);

    function rebalanceInterval() external view returns (uint256);

    function limaGovernance() external view returns (address);

    function owner() external view returns (address);

    function governanceToken(uint256 _protocoll)
        external
        view
        returns (address);

    /* ============ Setter ============ */

    function addUnderlyingToken(address _underlyingToken) external;

    function removeUnderlyingToken(address _underlyingToken) external;

    function setCurrentUnderlyingToken(address _currentUnderlyingToken)
        external;

    function setFeeWallet(address _feeWallet) external;

    function setBurnFee(uint256 _burnFee) external;

    function setMintFee(uint256 _mintFee) external;

    function setLimaToken(address _limaToken) external;

    function setPerformanceFee(uint256 _performanceFee) external;

    function setLastUnderlyingBalancePer1000(
        uint256 _lastUnderlyingBalancePer1000
    ) external;

    function setLastRebalance(uint256 _lastRebalance) external;

    function setLimaSwap(address _limaSwap) external;

    function setRebalanceInterval(uint256 _rebalanceInterval) external;

    /* ============ View ============ */

    function isUnderlyingTokens(address _underlyingToken)
        external
        view
        returns (bool);
}
