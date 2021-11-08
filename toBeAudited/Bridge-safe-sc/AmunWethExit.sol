//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

interface IRootChainManager {
    function exit(bytes calldata inputData) external;
}

/// @title This is a contract that bundles two matic bridge exits  
contract AmunWethExit {
    IRootChainManager public immutable rootChainManager;

    constructor(address _rootChainManager) {
        require(_rootChainManager != address(0), "new rootChainManager is the zero address");

        rootChainManager = IRootChainManager(_rootChainManager);
    }

    /// @notice This sends eth to user via amun weth
    /// @param inputDataWeth the hash of the bridge exit of weth to amun weth
    /// @param inputDataAmunWeth the hash of the bridge exit of amun weth
    function exit(
        bytes calldata inputDataWeth,
        bytes calldata inputDataAmunWeth
    ) external {
        rootChainManager.exit(inputDataWeth);
        rootChainManager.exit(inputDataAmunWeth);
    }
}
