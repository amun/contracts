pragma solidity ^0.6.2;


// import "@openzeppelin/upgrades/contracts/Initializable.sol";
import {ContextUpgradeSafe, Initializable} from "@openzeppelin/contracts-ethereum-package/contracts/GSN/Context.sol";

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an limaManager) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the limaManager account will be the one that deploys the contract. This
 * can later be changed with {transferLimaManagerOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyLimaManager`, which can be applied to your functions to restrict their use to
 * the limaManager.
 */
contract OwnableLimaManager is Initializable, ContextUpgradeSafe {
    address private _limaManager;

    event LimaManagerOwnershipTransferred(address indexed previousLimaManager, address indexed newLimaManager);

    /**
     * @dev Initializes the contract setting the deployer as the initial limaManager.
     */

    function __OwnableLimaManager_init() internal initializer {
        __Context_init_unchained();
        __OwnableLimaManager_init_unchained();
    }

    function __OwnableLimaManager_init_unchained() internal initializer {


        address msgSender = _msgSender();
        _limaManager = msgSender;
        emit LimaManagerOwnershipTransferred(address(0), msgSender);

    }


    /**
     * @dev Returns the address of the current limaManager.
     */
    function limaManager() public view returns (address) {
        return _limaManager;
    }

    /**
     * @dev Throws if called by any account other than the limaManager.
     */
    modifier onlyLimaManager() {
        require(_limaManager == _msgSender(), "OwnableLimaManager: caller is not the limaManager");
        _;
    }

    /**
     * @dev Leaves the contract without limaManager. It will not be possible to call
     * `onlyLimaManager` functions anymore. Can only be called by the current limaManager.
     *
     * NOTE: Renouncing limaManagership will leave the contract without an limaManager,
     * thereby removing any functionality that is only available to the limaManager.
     */
    function renounceLimaManagerOwnership() public virtual onlyLimaManager {
        emit LimaManagerOwnershipTransferred(_limaManager, address(0));
        _limaManager = address(0);
    }

    /**
     * @dev Transfers limaManagership of the contract to a new account (`newLimaManager`).
     * Can only be called by the current limaManager.
     */
    function transferLimaManagerOwnership(address newLimaManager) public virtual onlyLimaManager {
        require(newLimaManager != address(0), "OwnableLimaManager: new limaManager is the zero address");
        emit LimaManagerOwnershipTransferred(_limaManager, newLimaManager);
        _limaManager = newLimaManager;
    }

    uint256[49] private __gap;
}
