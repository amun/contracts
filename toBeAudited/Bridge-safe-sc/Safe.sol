//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./EIP712.sol";

contract Safe is EIP712 {
    using SafeERC20 for IERC20;

    address public owner;
    uint256 public nonce;

    // solhint-disable-next-line var-name-mixedcase
    bytes32 private immutable _PERMIT_TYPEHASH =
        keccak256(
            "Permit(address token,address beneficiary,int256 value,uint256 nonce,uint256 deadline)"
        );

    event SafeNativeTokenDeposit(uint256 amount);
    event SafeNativeTokenWithdraw(address indexed beneficiary, uint256 amount);
    event SafeDeposit(address indexed token, uint256 amount);
    event SafeWithdraw(
        address indexed token,
        address indexed beneficiary,
        uint256 amount
    );

    modifier onlyOwner() {
        require(owner == msg.sender, "!owner");

        _;
    }

    modifier requireNonZero(address token, uint256 amount) {
        require(token != address(0), "token not set");
        require(amount > 0, "amount is zero");

        _;
    }

    function initialize(string memory safeName, address _owner)
        external
        initializer
    {
        require(_owner != address(0), "new owner is the zero address");
        owner = _owner;
        initializeEIP712(safeName, "1");
    }

    /// @dev Supplies ERC20 token to safe
    /// @param token ERC20 address
    /// @param amount The amount to be supplied
    function depositInSafe(address token, uint256 amount)
        public
        onlyOwner
        requireNonZero(token, amount)
    {
        require(
            IERC20(token).allowance(msg.sender, address(this)) >= amount,
            "approve token to transfer tokens on your behalf"
        );
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit SafeDeposit(token, amount);
    }

    /// @dev Remove ERC20 token from safe
    /// @param token ERC20 address
    /// @param amount The amount to be withdrawn
    function withdrawFromSafe(address token, uint256 amount) external onlyOwner {
        _withdrawFromSafe(token, msg.sender, amount);
    }

    function _withdrawFromSafe(
        address _token,
        address _beneficiary,
        uint256 _amount
    ) private requireNonZero(_token, _amount) {
        IERC20(_token).safeTransfer(_beneficiary, _amount);

        emit SafeWithdraw(_token, _beneficiary, _amount);
    }

    /// @dev Check ERC20 token balances
    function balanceOfInSafe(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // fallback function
    receive() external payable onlyOwner {
        emit SafeNativeTokenDeposit(msg.value);
    }

    /// @dev Remove native token from safe
    /// @param amount The amount to be withdrawn
    function withdrawNativeTokenFromSafe(uint256 amount) external onlyOwner {
        _withdrawNativeTokenFromSafe(msg.sender, amount);
    }

    function _withdrawNativeTokenFromSafe(address _beneficiary, uint256 _amount)
        private
    {
        require(_amount > 0, "amount is zero");
        (bool success, ) = _beneficiary.call{value: _amount}("");
        require(success, "Transfer failed.");

        emit SafeNativeTokenWithdraw(_beneficiary, _amount);
    }

    /// @dev Check native token balance
    function balanceOfNativeTokenInSafe() external view returns (uint256) {
        return address(this).balance;
    }

    //////////////////////////  PERMIT FUNCTIONS //////////////////////////
    function permit(
        address token,
        address beneficiary,
        uint256 value,
        uint256 deadline,
        bool shouldTransferNativeToken,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        require(
            block.timestamp <= deadline,
            "WithdrawPermit: expired deadline"
        );

        bytes32 structHash = keccak256(
            abi.encode(
                _PERMIT_TYPEHASH,
                token,
                beneficiary,
                value,
                _useNonce(),
                deadline
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer == owner, "WithdrawPermit: invalid signature");

        if (shouldTransferNativeToken) {
            _withdrawNativeTokenFromSafe(beneficiary, value);
        } else {
            _withdrawFromSafe(token, beneficiary, value);
        }
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @dev "Consume a nonce": return the current value and increment.
     */
    function _useNonce() internal virtual returns (uint256 current) {
        current = nonce;
        nonce += 1;
    }
}
