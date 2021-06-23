// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity ^0.7.5;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../../interfaces/ILendingLogic.sol";

// TODO consider making this contract upgradeable
contract LendingRegistry is Ownable {
    // Maps wrapped token to protocol
    mapping(address => bytes32) public wrappedToProtocol;
    // Maps wrapped token to underlying
    mapping(address => address) public wrappedToUnderlying;

    mapping(address => mapping(bytes32 => address))
        public underlyingToProtocolWrapped;

    // Maps protocol to addresses containing lend and unlend logic
    mapping(bytes32 => address) public protocolToLogic;

    event WrappedToProtocolSet(
        address indexed wrapped,
        bytes32 indexed protocol
    );
    event WrappedToUnderlyingSet(
        address indexed wrapped,
        address indexed underlying
    );
    event ProtocolToLogicSet(bytes32 indexed protocol, address indexed logic);
    event UnderlyingToProtocolWrappedSet(
        address indexed underlying,
        bytes32 indexed protocol,
        address indexed wrapped
    );

    /**
        @notice Set which protocl a wrapped token belongs to
        @param _wrapped Address of the wrapped token
        @param _protocol Bytes32 key of the protocol
    */
    function setWrappedToProtocol(address _wrapped, bytes32 _protocol)
        external
        onlyOwner
    {
        wrappedToProtocol[_wrapped] = _protocol;
        emit WrappedToProtocolSet(_wrapped, _protocol);
    }

    /**
        @notice Set what is the underlying for a wrapped token
        @param _wrapped Address of the wrapped token
        @param _underlying Address of the underlying token
    */
    function setWrappedToUnderlying(address _wrapped, address _underlying)
        external
        onlyOwner
    {
        wrappedToUnderlying[_wrapped] = _underlying;
        emit WrappedToUnderlyingSet(_wrapped, _underlying);
    }

    /**
        @notice Set the logic contract for the protocol
        @param _protocol Bytes32 key of the procol
        @param _logic Address of the lending logic contract for that protocol
    */
    function setProtocolToLogic(bytes32 _protocol, address _logic)
        external
        onlyOwner
    {
        protocolToLogic[_protocol] = _logic;
        emit ProtocolToLogicSet(_protocol, _logic);
    }

    /**
        @notice Set the wrapped token for the underlying deposited in this protocol
        @param _underlying Address of the unerlying token
        @param _protocol Bytes32 key of the protocol
        @param _wrapped Address of the wrapped token
    */
    function setUnderlyingToProtocolWrapped(
        address _underlying,
        bytes32 _protocol,
        address _wrapped
    ) external onlyOwner {
        underlyingToProtocolWrapped[_underlying][_protocol] = _wrapped;
        emit UnderlyingToProtocolWrappedSet(_underlying, _protocol, _wrapped);
    }

    /**
        @notice Get tx data to lend the underlying amount in a specific protocol
        @param _underlying Address of the underlying token
        @param _amount Amount to lend
        @param _protocol Bytes32 key of the protocol
        @return targets Addresses of the contracts to call
        @return data Calldata for the calls
    */
    function getLendTXData(
        address _underlying,
        uint256 _amount,
        bytes32 _protocol
    ) external view returns (address[] memory targets, bytes[] memory data) {
        ILendingLogic lendingLogic = ILendingLogic(protocolToLogic[_protocol]);
        require(address(lendingLogic) != address(0), "NO_LENDING_LOGIC_SET");

        return lendingLogic.lend(_underlying, _amount);
    }

    /**
        @notice Get the tx data to unlend the wrapped amount
        @param _wrapped Address of the wrapped token
        @param _amount Amount of wrapped token to unlend
        @return targets Addresses of the contracts to call
        @return data Calldata for the calls
    */
    function getUnlendTXData(address _wrapped, uint256 _amount)
        external
        view
        returns (address[] memory targets, bytes[] memory data)
    {
        ILendingLogic lendingLogic =
            ILendingLogic(protocolToLogic[wrappedToProtocol[_wrapped]]);
        require(address(lendingLogic) != address(0), "NO_LENDING_LOGIC_SET");

        return lendingLogic.unlend(_wrapped, _amount);
    }

    /**
        @notice Get the beste apr for the give protocols
        @dev returns default values if lending logic not found
        @param _underlying Address of the underlying token
        @param _protocols Array of protocols to include
        @return apr The APR
        @return protocol Protocol that provides the APR
    */
    function getBestApr(address _underlying, bytes32[] memory _protocols)
        external
        view
        returns (uint256 apr, bytes32 protocol)
    {
        uint256 bestApr;
        bytes32 bestProtocol;

        for (uint256 i = 0; i < _protocols.length; i++) {
            bytes32 protocol = _protocols[i];
            ILendingLogic lendingLogic =
                ILendingLogic(protocolToLogic[protocol]);
            require(
                address(lendingLogic) != address(0),
                "NO_LENDING_LOGIC_SET"
            );

            uint256 apr = lendingLogic.getAPRFromUnderlying(_underlying);
            if (apr > bestApr) {
                bestApr = apr;
                bestProtocol = protocol;
            }
        }

        return (bestApr, bestProtocol);
    }
}
