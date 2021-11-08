//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface IChildAmunWeth {
    function getAmunWeth(uint256 amount) external;

    function withdraw(uint256 amount) external;

    function withdrawTo(uint256 amount, address receiver) external;
}
