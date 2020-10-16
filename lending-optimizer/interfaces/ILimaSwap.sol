pragma solidity ^0.6.2;

import {
    IERC20
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

interface ILimaSwap {
    function getExpectedReturn(
        address fromToken,
        address toToken,
        uint256 amount
    ) external view returns (uint256 returnAmount);

    function swap(
        address recipient,
        address from,
        address to,
        uint256 amount,
        uint256 minReturnAmount
    ) external returns (uint256 returnAmount);
}
