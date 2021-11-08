//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
    {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }

    /**
     * @notice called when token is deposited on root chain
     * @dev Should be callable only by ChildChainManager
     * Should handle deposit by minting the required amount for user
     * Make sure minting is done only by this function
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
    function deposit(address user, bytes calldata depositData) external {
        require(
            _msgSender() == 0xb5505a6d998549090530911180f38aC5130101c6,
            "ONLY_CHILD_CHAIN_MANAGER"
        );
        uint256 amount = abi.decode(depositData, (uint256));

        emit Transfer(address(0), user, amount); //mint
    }

    function withdraw(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function withdrawTo(uint256 amount, address account) external {
        _transfer(msg.sender, account, amount);
        _burn(account, amount);
    }
}
