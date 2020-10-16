pragma solidity ^0.6.2;

import {
    ERC20PausableUpgradeSafe,
    IERC20,
    SafeMath
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20Pausable.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import {AddressArrayUtils} from "./library/AddressArrayUtils.sol";
import {OwnableLimaManager} from "./limaTokenModules/OwnableLimaManager.sol";
import {ILimaSwap} from "./interfaces/ILimaSwap.sol";

/**
 * @title LimaToken
 * @author Lima Protocol
 *
 * Standard LimaToken.
 */
contract LimaToken is OwnableLimaManager, ERC20PausableUpgradeSafe {
    using AddressArrayUtils for address[];
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_UINT256 = 2**256 - 1;
    // List of UnderlyingTokens
    address[] public underlyingTokens;
    address public currentUnderlyingToken;
    address public owner;
    ILimaSwap public limaSwap;

    /**
     * @dev Initializes contract
     */
    function initialize(
        string memory name,
        string memory symbol,
        address _limaSwap
    ) public initializer {
        owner = _msgSender();
        limaSwap = ILimaSwap(_limaSwap);
        __Context_init_unchained();

        __OwnableLimaManager_init_unchained();

        __ERC20_init(name, symbol);
        __ERC20Pausable_init();
    }

    /* ============ Modifiers ============ */

    modifier onlyUnderlyingToken(address _token) {
        // Internal function used to reduce bytecode size
        require(
            isUnderlyingTokens(_token),
            "Only token that are part of Underlying Tokens"
        );
        _;
    }

    /**
     * @dev Throws if called by any account other than the limaManager.
     */
    modifier onlyLimaManagerOrOwner() {
        require(
            limaManager() == _msgSender() || owner == _msgSender(),
            "Ownable: caller is not the limaManager or owner"
        );
        _;
    }

    /* ============ Getter Setter ============ */

    function addUnderlyingToken(address _underlyingToken)
        external
        onlyLimaManagerOrOwner
    {
        IERC20(_underlyingToken).safeApprove(address(limaSwap), MAX_UINT256);
        underlyingTokens.push(_underlyingToken);
    }

    function removeUnderlyingToken(address _underlyingToken)
        external
        onlyLimaManagerOrOwner
    {
        underlyingTokens = underlyingTokens.remove(_underlyingToken);
    }

    function setCurrentUnderlyingToken(address _currentUnderlyingToken)
        external
        onlyUnderlyingToken(_currentUnderlyingToken)
        onlyLimaManagerOrOwner
    {
        currentUnderlyingToken = _currentUnderlyingToken;
    }

    function setLimaSwap(address _limaSwap)
        public
        onlyLimaManagerOrOwner
    {
        require(_limaSwap != address(0), "LimaSwap: new lima swap is the zero address");
        limaSwap = ILimaSwap(_limaSwap);
    }

    /* ============ View ============ */

    function isUnderlyingTokens(address _underlyingToken)
        public
        view
        returns (bool)
    {
        return underlyingTokens.contains(_underlyingToken);
    }

    function getTokenValueOf(
        address _fromToken,
        address _targetToken,
        uint256 _amount
    ) public view returns (uint256 value) {
        value = limaSwap.getExpectedReturn(_fromToken, _targetToken, _amount);
        return value;
    }

    function getCurrentUnderlyingTokenValue(address _targetToken)
        public
        view
        returns (uint256 netTokenValue)
    {
        return
            getTokenValueOf(
                currentUnderlyingToken,
                _targetToken,
                getUnderlyingTokenBalance()
            );
    }

    function getTotalTokenValue(address _targetToken)
        public
        view
        returns (uint256 netTokenValue)
    {
        return getCurrentUnderlyingTokenValue(_targetToken);
    }

    /**
     * @dev Get token value.
     */
    function getTokenValue(address _targetToken)
        public
        view
        returns (uint256 tokenValue)
    {
        //todo is this one ??
        return getTokenValueOf(currentUnderlyingToken, _targetToken, 1 ether); //10 ** IERC20(currentUnderlyingToken).decimals());
    }

    /**
     * @dev Get total net token value.
     */
    function getNetTokenValue(address _targetToken)
        public
        view
        returns (uint256 netTokenValue)
    {
        return getTotalTokenValue(_targetToken);
    }

    function getUnderlyingTokenBalance() public view returns (uint256 balance) {
        return IERC20(currentUnderlyingToken).balanceOf(address(this));
    }

    function getUnderlyingTokenBalancePerToken()
        public
        view
        returns (uint256 balancePerToken)
    {
        uint256 balance = getUnderlyingTokenBalance();
        return balance.div(totalSupply());
    }

    /* ============ Lima Manager ============ */

    //to allow rebalances to happen limaSwap needs to be approved
    function approveUnderlyingToken(uint256 amount)
        public
        onlyLimaManagerOrOwner
        returns (bool)
    {
        IERC20(currentUnderlyingToken).safeApprove(limaManager(), amount);
        IERC20(currentUnderlyingToken).safeApprove(address(limaSwap), amount);

        return true;
    }

    // functions used in rebalances
    function mint(address account, uint256 amount)
        public
        onlyLimaManagerOrOwner
    {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount)
        public
        onlyLimaManagerOrOwner
    {
        _burn(account, amount);
    }

    // pausable functions
    function pause() external onlyLimaManagerOrOwner {
        _pause();
    }

    function unpause() external onlyLimaManagerOrOwner {
        _unpause();
    }

    function _swap(
        IERC20 _from,
        IERC20 _to,
        uint256 _amount
    ) internal returns (uint256 returnAmount) {
        if (address(_from) != address(_to)) {
            returnAmount = limaSwap.getExpectedReturn(
                address(_from),
                address(_to),
                _amount
            );
            returnAmount = limaSwap.swap(_msgSender(), address(_from), address(_to), _amount, returnAmount);
            return returnAmount;
        }
        return _amount;
    }

    //for airdrops ..
    function swapToUnderlying(IERC20 _from, uint256 _amount)
        public
        onlyLimaManagerOrOwner
        returns (uint256 returnAmount)
    {
        return swap(_from, IERC20(currentUnderlyingToken), _amount);
    }

    /**
     * Swaps '_amount' token from '_from' to '_to' with 1Inch. Returns the amount of token swapped to.
     */
    function swap(
        IERC20 _from,
        IERC20 _to,
        uint256 _amount
    ) public onlyLimaManagerOrOwner returns (uint256 returnAmount) {
        return _swap(_from, _to, _amount);
    }

    /* ============ Main Functions ============ */

    /**
     * @dev Rebalances LimaToken
     */
    function rebalance(address _bestToken)
        external
        onlyLimaManagerOrOwner
        returns (bool)
    {
        //todo or do this manual?
        if (
            IERC20(currentUnderlyingToken).allowance(
                address(this),
                address(limaSwap)
            ) < 1000 ether
        ) {
            IERC20(currentUnderlyingToken).safeApprove(
                address(limaSwap),
                MAX_UINT256
            );
            IERC20(currentUnderlyingToken).safeApprove(
                limaManager(),
                MAX_UINT256
            );
        }
        swap(
            IERC20(currentUnderlyingToken),
            IERC20(_bestToken),
            getUnderlyingTokenBalance()
        );
        currentUnderlyingToken = _bestToken;

        return true;
    }

    /* ============ User ============ */

    /**
     * @dev Creates new token for holder by converting _investmentToken value to LimaToken
     */
    //User needs to approve _investmentToken to contract  ??
    function create(
        IERC20 _investmentToken,
        uint256 _amount,
        address _holder
    ) external returns (bool) {
        uint256 balancePerToken = getUnderlyingTokenBalancePerToken();
        require(balancePerToken != 0, "balancePerToken must not be zero");

        _investmentToken.safeTransferFrom(msg.sender, address(this), _amount);

        //swap to currentUnderlyingToken, when not inkind
        _amount = _swap(
            _investmentToken,
            IERC20(currentUnderlyingToken),
            _amount
        );
        //todo check amount?
        _mint(_holder, _amount.div(balancePerToken));

        require(
            balancePerToken == getUnderlyingTokenBalancePerToken(),
            "Create should not change balance per token."
        );
        return true;
    }

    /**
     * @dev Redeem the value of LimaToken in _payoutToken.
     */
    function redeem(
        IERC20 _payoutToken,
        uint256 _amount,
        address _holder
    ) external returns (bool) {
        uint256 balancePerToken = getUnderlyingTokenBalancePerToken();
        require(balancePerToken != 0, "balancePerToken must not be zero");

        _burn(msg.sender, _amount);
        _amount = balancePerToken.mul(_amount);

        //swap from currentUnderlyingToken to _payoutToken, when not inkind
        _amount = _swap(IERC20(currentUnderlyingToken), _payoutToken, _amount);
        //todo check amount?

        _payoutToken.safeTransfer(_holder, _amount);
        require(
            balancePerToken == getUnderlyingTokenBalancePerToken(),
            "Redeem should not change balance per token."
        );

        return true;
    }
}
