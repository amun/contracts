//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface ISafeFactory {
    event SafeCreated(address indexed safeOwner, address safeAddress);

    function createSafe(string memory) external returns (address payable safe);

    function safeFor(address) external view returns (address safe);
}
