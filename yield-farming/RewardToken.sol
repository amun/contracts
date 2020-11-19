pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/ERC20Capped.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "./Governable.sol";

contract RewardToken is ERC20, ERC20Detailed, ERC20Capped, Governable {

  uint256 public constant HARD_CAP = 5 * (10 ** 6) * (10 ** 18);

  constructor(address _storage) public
  ERC20Detailed("AMUN Reward Token", "AMUN", 18)
  ERC20Capped(HARD_CAP)
  Governable(_storage) {
    // msg.sender should not be a minter
    renounceMinter();
    // governance will become the only minter
    _addMinter(governance());
  }

  /**
  * Overrides adding new minters so that only governance can authorized them.
  */
  function addMinter(address _minter) public onlyGovernance {
    super.addMinter(_minter);
  }
}
