//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./interfaces/ISafeFactory.sol";
import "./Safe.sol";

contract SafeFactory is ISafeFactory {
    mapping(address => bool) public hasCreatedSafe;

    /// @dev creates user's safe using CREATE2 opcode
    function createSafe(string memory safeName)
        external
        override
        returns (address payable safe)
    {
        require(
            !hasCreatedSafe[msg.sender],
            "Safe already created for address"
        );

        bytes memory bytecode = type(Safe).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(msg.sender));
        assembly {
            safe := create2(0, add(bytecode, 32), mload(bytecode), salt)
            if iszero(extcodesize(safe)) {
                revert(0, 0)
            }
        }
        Safe(safe).initialize(safeName, msg.sender);

        hasCreatedSafe[msg.sender] = true;

        emit SafeCreated(msg.sender, safe);
    }

    /// @dev calculates the CREATE2 address for an address
    function safeFor(address safeOwner)
        external
        view
        override
        returns (address safe)
    {
        bytes memory bytecode = type(Safe).creationCode;

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                keccak256(abi.encodePacked(safeOwner)),
                keccak256(bytecode)
            )
        );

        safe = address(uint160(uint256(hash)));
    }
}
