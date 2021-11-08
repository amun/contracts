//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;
import "./interfaces/IChildAmunWeth.sol";
import "./interfaces/IBridgeToken.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/// @title This is a token that acts as an IOU of its underlying.
/// @author Timo
/// @notice Needs to deploy under same address on ethereum
contract ChildAmunWeth is ERC20Upgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IBridgeToken public underlying;
    address public childChainManager;

    function initialize(
        string memory name,
        string memory symbol,
        address _underlying,
        address _childChainManager
    ) public initializer {
        require(
            _underlying != address(0),
            "new underlying is the zero address"
        );
        require(
            _childChainManager != address(0),
            "new childChainManager is the zero address"
        );
        __ERC20_init(name, symbol);
        underlying = IBridgeToken(_underlying);
        childChainManager = _childChainManager;
    }

    /**
     * @notice called when minting  AmunWeth
     * @dev Should be called to get AmunWeth for weth
     * @param amount create AmunWeth for weth
     */
    function getAmunWeth(uint256 amount) external  {
        IERC20Upgradeable(address(underlying)).safeTransferFrom(
            _msgSender(),
            address(this),
            amount
        );
        underlying.withdraw(amount); //sends to same addres as this contract on ethereum
        _mint(_msgSender(), amount);
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required amount for recipient
     * Make sure minting is done only by this function
     * @param recipient user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
    function deposit(address recipient, bytes calldata depositData) external {
        require(_msgSender() == childChainManager, "ONLY_CHILD_CHAIN_MANAGER");
        uint256 amount = abi.decode(depositData, (uint256));

        _mint(recipient, amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external  {
        _burn(_msgSender(), amount);
    }

    /**
     * @notice called when user wants to withdraw tokens back to root chain
     * @dev Should burn user's tokens. This transaction will be verified when exiting on root chain
     * @param amount amount of tokens to withdraw
     * @param recipient recipient of tokens to withdraw
     */
    function withdrawTo(uint256 amount, address recipient) external  {
        _transfer(_msgSender(), recipient, amount);
        _burn(recipient, amount);
    }
}
