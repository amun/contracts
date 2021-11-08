//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

/// @title This is a token that is used to allow transfering a token on ethereum under any address
/// @author Timo
/// @notice Needs to deploy under same address on ethereum
interface IRootAmunWeth {
    /**
     * @notice called when underlying is redeemed on root chain
     * @dev Should be callable only on root chain
     * @param amount redeem amount
     */
    function redeemWeth(uint256 amount) external;

    /**
     * @notice called when underlying is redeemed on root chain
     * @dev Should be callable only on root chain
     * @param amount redeem amount
     */
    function redeemWethFor(uint256 amount, address payable recipent) external;
}
