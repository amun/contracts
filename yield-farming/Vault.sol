pragma solidity 0.5.16;

import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ERC20Detailed.sol";
import "./hardworkInterface/IStrategy.sol";
import "./hardworkInterface/IController.sol";
import "./hardworkInterface/IVault.sol";
import "./hardworkInterface/IUpgradeSource.sol";
import "./ControllableInit.sol";
import "./VaultStorage.sol";

contract Vault is
    ERC20,
    ERC20Detailed,
    IVault,
    IUpgradeSource,
    ControllableInit,
    VaultStorage
{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    mapping(address => uint256) internal userLastDeposit;

    event Withdraw(address indexed beneficiary, uint256 amount);
    event Deposit(
        address indexed beneficiary,
        uint256 amount,
        uint16 indexed referral
    );
    event Invest(uint256 amount);
    event StrategyAnnounced(address newStrategy, uint256 time);
    event StrategyChanged(address newStrategy, address oldStrategy);

    constructor() public {}

    // the function is name differently to not cause inheritance clash in truffle and allows tests
    function initializeVault(
        address _storage,
        address _underlying,
        uint256 _toInvestNumerator,
        uint256 _toInvestDenominator
    ) public initializer {
        require(
            _toInvestNumerator <= _toInvestDenominator,
            "cannot invest more than 100%"
        );
        require(_toInvestDenominator != 0, "cannot divide by 0");

        ERC20Detailed.initialize(
            string(
                abi.encodePacked("AMUN_", ERC20Detailed(_underlying).symbol())
            ),
            string(
                abi.encodePacked("amun", ERC20Detailed(_underlying).symbol())
            ),
            ERC20Detailed(_underlying).decimals()
        );
        ControllableInit.initialize(_storage);

        uint256 underlyingUnit =
            10**uint256(ERC20Detailed(address(_underlying)).decimals());
        uint256 implementationDelay = 12 hours;
        uint256 strategyChangeDelay = 12 hours;
        VaultStorage.initialize(
            _underlying,
            _toInvestNumerator,
            _toInvestDenominator,
            underlyingUnit,
            implementationDelay,
            strategyChangeDelay
        );
    }

    function strategy() public view returns (address) {
        return _strategy();
    }

    function underlying() public view returns (address) {
        return _underlying();
    }

    function underlyingUnit() public view returns (uint256) {
        return _underlyingUnit();
    }

    function vaultFractionToInvestNumerator() public view returns (uint256) {
        return _vaultFractionToInvestNumerator();
    }

    function vaultFractionToInvestDenominator() public view returns (uint256) {
        return _vaultFractionToInvestDenominator();
    }

    function nextImplementation() public view returns (address) {
        return _nextImplementation();
    }

    function nextImplementationTimestamp() public view returns (uint256) {
        return _nextImplementationTimestamp();
    }

    function nextImplementationDelay() public view returns (uint256) {
        return _nextImplementationDelay();
    }

    modifier whenStrategyDefined() {
        require(address(strategy()) != address(0), "Strategy must be defined");
        _;
    }

    /**
     * Chooses the best strategy and re-invests. If the strategy did not change, it just calls
     * doHardWork on the current strategy. Call this through controller to claim hard rewards.
     */
    function doHardWork()
        external
        whenStrategyDefined
        onlyControllerOrGovernance
    {
        // ensure that new funds are invested too
        invest();
        IStrategy(strategy()).doHardWork();
    }

    /*
     * Returns the cash balance across all users in this contract.
     */
    function underlyingBalanceInVault() public view returns (uint256) {
        return IERC20(underlying()).balanceOf(address(this));
    }

    /* Returns the current underlying (e.g., DAI's) balance together with
     * the invested amount (if DAI is invested elsewhere by the strategy).
     */
    function underlyingBalanceWithInvestment() public view returns (uint256) {
        if (address(strategy()) == address(0)) {
            // initial state, when not set
            return underlyingBalanceInVault();
        }
        return
            underlyingBalanceInVault().add(
                IStrategy(strategy()).investedUnderlyingBalance()
            );
    }

    function getPricePerFullShare() public view returns (uint256) {
        return
            totalSupply() == 0
                ? underlyingUnit()
                : underlyingUnit().mul(underlyingBalanceWithInvestment()).div(
                    totalSupply()
                );
    }

    /* get the user's share (in underlying)
     */
    function underlyingBalanceWithInvestmentForHolder(address holder)
        external
        view
        returns (uint256)
    {
        if (totalSupply() == 0) {
            return 0;
        }
        return
            underlyingBalanceWithInvestment().mul(balanceOf(holder)).div(
                totalSupply()
            );
    }

    function futureStrategy() public view returns (address) {
        return _futureStrategy();
    }

    function strategyUpdateTime() public view returns (uint256) {
        return _strategyUpdateTime();
    }

    function strategyTimeLock() public view returns (uint256) {
        return _strategyTimeLock();
    }

    function canUpdateStrategy(address _strategy) public view returns (bool) {
        return
            strategy() == address(0) || // no strategy was set yet
            (_strategy == futureStrategy() &&
                block.timestamp > strategyUpdateTime() &&
                strategyUpdateTime() > 0); // or the timelock has passed
    }

    /**
     * Indicates that the strategy update will happen in the future
     */
    function announceStrategyUpdate(address _strategy)
        public
        onlyControllerOrGovernance
    {
        // records a new timestamp
        uint256 when = block.timestamp.add(strategyTimeLock());
        _setStrategyUpdateTime(when);
        _setFutureStrategy(_strategy);
        emit StrategyAnnounced(_strategy, when);
    }

    /**
     * Finalizes (or cancels) the strategy update by resetting the data
     */
    function finalizeStrategyUpdate() public onlyControllerOrGovernance {
        _setStrategyUpdateTime(0);
        _setFutureStrategy(address(0));
    }

    function setStrategy(address _strategy) public onlyControllerOrGovernance {
        require(
            canUpdateStrategy(_strategy),
            "The strategy exists and switch timelock did not elapse yet"
        );
        require(_strategy != address(0), "new _strategy cannot be empty");
        require(
            IStrategy(_strategy).underlying() == address(underlying()),
            "Vault underlying must match Strategy underlying"
        );
        require(
            IStrategy(_strategy).vault() == address(this),
            "the strategy does not belong to this vault"
        );

        emit StrategyChanged(_strategy, strategy());
        if (address(_strategy) != address(strategy())) {
            if (address(strategy()) != address(0)) {
                // if the original strategy (no underscore) is defined
                IERC20(underlying()).safeApprove(address(strategy()), 0);
                IStrategy(strategy()).withdrawAllToVault();
            }
            _setStrategy(_strategy);
            IERC20(underlying()).safeApprove(address(strategy()), 0);
            IERC20(underlying()).safeApprove(address(strategy()), uint256(~0));
        }
        finalizeStrategyUpdate();
    }

    function setVaultFractionToInvest(uint256 numerator, uint256 denominator)
        external
        onlyGovernance
    {
        require(denominator > 0, "denominator must be greater than 0");
        require(
            numerator <= denominator,
            "denominator must be greater than or equal to the numerator"
        );
        _setVaultFractionToInvestNumerator(numerator);
        _setVaultFractionToInvestDenominator(denominator);
    }

    function rebalance() external onlyControllerOrGovernance {
        withdrawAll();
        invest();
    }

    function availableToInvestOut() public view returns (uint256) {
        uint256 wantInvestInTotal =
            underlyingBalanceWithInvestment()
                .mul(vaultFractionToInvestNumerator())
                .div(vaultFractionToInvestDenominator());
        uint256 alreadyInvested =
            IStrategy(strategy()).investedUnderlyingBalance();
        if (alreadyInvested >= wantInvestInTotal) {
            return 0;
        } else {
            uint256 remainingToInvest = wantInvestInTotal.sub(alreadyInvested);
            return
                remainingToInvest <= underlyingBalanceInVault() // TODO: we think that the "else" branch of the ternary operation is not // going to get hit
                    ? remainingToInvest
                    : underlyingBalanceInVault();
        }
    }

    function invest() internal whenStrategyDefined {
        uint256 availableAmount = availableToInvestOut();
        if (availableAmount > 0) {
            IERC20(underlying()).safeTransfer(
                address(strategy()),
                availableAmount
            );
            emit Invest(availableAmount);
        }
    }

    /*
     * Allows for depositing the underlying asset in exchange for shares.
     * Approval is assumed.
     */
    function deposit(uint256 amount, uint16 _referral) external {
        _deposit(amount, msg.sender, msg.sender, _referral);
    }

    /*
     * Allows for depositing the underlying asset in exchange for shares
     * assigned to the holder.
     * This facilitates depositing for someone else (using DepositHelper)
     */
    function depositFor(
        uint256 amount,
        address holder,
        uint16 _referral
    ) public {
        _deposit(amount, msg.sender, holder, _referral);
    }

    function withdrawAll()
        public
        onlyControllerOrGovernance
        whenStrategyDefined
    {
        IStrategy(strategy()).withdrawAllToVault();
    }

    function withdraw(uint256 numberOfShares) external {
        require(
            block.number + 2 > userLastDeposit[msg.sender],
            "cannot withdraw within the same block"
        );
        require(totalSupply() > 0, "Vault has no shares");
        require(numberOfShares > 0, "numberOfShares must be greater than 0");
        uint256 totalSupply = totalSupply();
        _burn(msg.sender, numberOfShares);

        uint256 underlyingAmountToWithdraw =
            underlyingBalanceWithInvestment().mul(numberOfShares).div(
                totalSupply
            );
        if (underlyingAmountToWithdraw > underlyingBalanceInVault()) {
            // withdraw everything from the strategy to accurately check the share value
            if (numberOfShares == totalSupply) {
                IStrategy(strategy()).withdrawAllToVault();
            } else {
                uint256 missing =
                    underlyingAmountToWithdraw.sub(underlyingBalanceInVault());
                IStrategy(strategy()).withdrawToVault(missing);
            }
            // recalculate to improve accuracy
            underlyingAmountToWithdraw = Math.min(
                underlyingBalanceWithInvestment().mul(numberOfShares).div(
                    totalSupply
                ),
                underlyingBalanceInVault()
            );
        }

        IERC20(underlying()).safeTransfer(
            msg.sender,
            underlyingAmountToWithdraw
        );

        // update the withdrawal amount for the holder
        emit Withdraw(msg.sender, underlyingAmountToWithdraw);
    }

    function _deposit(
        uint256 amount,
        address sender,
        address beneficiary,
        uint16 _referral
    ) internal {
        require(amount > 0, "Cannot deposit 0");
        require(beneficiary != address(0), "holder must be defined");

        if (address(strategy()) != address(0)) {
            require(IStrategy(strategy()).depositArbCheck(), "Too much arb");
        }

        userLastDeposit[tx.origin] = block.number;

        uint256 toMint =
            totalSupply() == 0
                ? amount
                : amount.mul(totalSupply()).div(
                    underlyingBalanceWithInvestment()
                );
        _mint(beneficiary, toMint);

        IERC20(underlying()).safeTransferFrom(sender, address(this), amount);

        // update the contribution amount for the beneficiary
        emit Deposit(beneficiary, amount, _referral);
    }

    /**
     * Schedules an upgrade for this vault's proxy.
     */
    function scheduleUpgrade(address impl) public onlyGovernance {
        _setNextImplementation(impl);
        _setNextImplementationTimestamp(
            block.timestamp.add(nextImplementationDelay())
        );
    }

    function shouldUpgrade() external view returns (bool, address) {
        return (
            nextImplementationTimestamp() != 0 &&
                block.timestamp > nextImplementationTimestamp() &&
                nextImplementation() != address(0),
            nextImplementation()
        );
    }

    function finalizeUpgrade() external onlyGovernance {
        _setNextImplementation(address(0));
        _setNextImplementationTimestamp(0);
    }
}
