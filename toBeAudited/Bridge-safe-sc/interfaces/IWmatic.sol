//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWmatic is IERC20 {
    function deposit() external payable;
}
