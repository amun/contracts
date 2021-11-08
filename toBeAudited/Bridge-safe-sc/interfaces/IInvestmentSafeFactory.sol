//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./IChildAmunWeth.sol";

interface IUniswapRouter {
    function WETH() external view returns (address);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

interface IInvestmentSafeFactory {
    event SafeCreated(address indexed safeOwner, address safeAddress);

    function singleTokenJoin() external view returns (address);

    function singleTokenExit() external view returns (address);

    function weth() external view returns (address);

    function childAmunWeth() external view returns (address);

    function _PERMIT_JOIN_TYPEHASH() external view returns (bytes32);

    function _PERMIT_EXIT_TYPEHASH() external view returns (bytes32);

    function EXIT_GAS() external view returns (uint256);

    function JOIN_GAS() external view returns (uint256);

    function GAS_CREATE_SAFE() external view returns (uint256);

    function createSafeFor(string memory, address)
        external
        returns (address payable safe);

    function safeFor(address) external view returns (address safe);

    function getWethUsedForGas(uint256 gas)
        external
        view
        returns (uint256 wethUsedForSafe);
}
