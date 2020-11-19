pragma solidity 0.5.16;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../hardworkInterface/IStrategy.sol";
import "../Controllable.sol";
import "../hardworkInterface/IVault.sol";


contract NoopStrategyStable is IStrategy, Controllable {
  using SafeERC20 for IERC20;
  using Address for address;
  using SafeMath for uint256;

  IERC20 public underlying;
  IVault public vault;

  // These tokens cannot be claimed by the controller
  mapping(address => bool) public unsalvagableTokens;

  constructor(address _storage, address _vault) public
  Controllable(_storage) {
    require(_vault != address(0), "_vault cannot be empty");
    vault = IVault(_vault);
    underlying = IERC20(vault.underlying());
    unsalvagableTokens[address(underlying)] = true;
  }

  modifier restricted() {
    require(msg.sender == address(vault) || msg.sender == address(controller()) || msg.sender == address(governance()),
      "The sender has to be the controller or vault or governance");
    _;
  }

  function depositArbCheck() public view returns(bool) {
    return true;
  }

  modifier onlyVault() {
    require(msg.sender == address(vault), "The caller must be the vault");
    _;
  }

  /*
  * Returns the total invested amount.
  */
  function investedUnderlyingBalance() view public returns (uint256) {
    // for real strategies, need to calculate the invested balance
    return underlying.balanceOf(address(this));
  }

  /*
  * Invests all tokens that were accumulated so far
  */
  function investAllUnderlying() public {
    // a no-op
  }

  /*
  * Cashes everything out and withdraws to the vault
  */
  function withdrawAllToVault() external restricted {
    if (underlying.balanceOf(address(this)) > 0) {
      underlying.safeTransfer(address(vault), underlying.balanceOf(address(this)));
    }
  }

  /*
  * Cashes some amount out and withdraws to the vault
  */
  function withdrawToVault(uint256 amount) external restricted {
    if (amount > 0) {
      underlying.safeTransfer(address(vault), amount);
    }
  }

  /*
  * Honest harvesting. It's not much, but it pays off
  */
  function doHardWork() external restricted {
    // a no-op
  }

  // should only be called by controller
  function salvage(address destination, address token, uint256 amount) external restricted {
    require(!unsalvagableTokens[token], "token is defined as not salvageable");
    IERC20(token).safeTransfer(destination, amount);
  }
}
