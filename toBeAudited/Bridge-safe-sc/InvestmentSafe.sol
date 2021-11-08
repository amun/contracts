//SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./EIP712.sol";
import "./interfaces/IChildAmunWeth.sol";
import "./interfaces/IPolygonERC20Wrapper.sol";
import "./interfaces/ISingleTokenJoinV2.sol";
import "./interfaces/ISingleNativeTokenExitV2.sol";
import "./interfaces/IInvestmentSafe.sol";
import "./interfaces/IInvestmentSafeFactory.sol";

contract InvestmentSafe is EIP712, IInvestmentSafe {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public owner;
    mapping(address => uint256) public nonces;

    mapping(address => Steps) public exitStep;
    mapping(address => bool) public isSecondJoinStep;
    uint256 public bridgeAmount;

    IInvestmentSafeFactory public investmentSafeFactory;

    event SafeWithdraw(
        address indexed token,
        address indexed beneficiary,
        uint256 amount
    );
    event DelegatedJoin(
        address indexed token,
        address indexed beneficiary,
        uint256 sourceAmount,
        uint256 targetAmount
    );
    event DelegatedExit(
        address indexed token,
        address indexed beneficiary,
        uint256 sourceAmount,
        uint256 targetAmount
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

    function _initialize(
        string memory safeName,
        address _owner,
        address _investmentSafeFactory,
        address _creator
    ) internal {
        require(_owner != address(0), "new owner is the zero address");
        require(
            _investmentSafeFactory != address(0),
            "new investmentSafeFactory is the zero address"
        );
        require(_creator != address(0), "new creator is the zero address");
        owner = _owner;
        initializeEIP712(safeName, "1");
        investmentSafeFactory = IInvestmentSafeFactory(_investmentSafeFactory);
    }

    function _paybackGas(address recipient, uint256 gas) internal {
        uint256 amount = investmentSafeFactory.getWethUsedForGas(gas);
        IERC20(investmentSafeFactory.weth()).safeTransfer(recipient, amount);
    }

    function initialize(
        string memory safeName,
        address _owner,
        address _investmentSafeFactory,
        address _creator
    ) external initializer {
        _initialize(safeName, _owner, _investmentSafeFactory, _creator);

        if (_owner != _creator) {
            _paybackGas(_creator, investmentSafeFactory.GAS_CREATE_SAFE());
        }
    }

    function initializeAndJoin(
        string memory safeName,
        address _owner,
        address _investmentSafeFactory,
        address _creator,
        DelegateJoinData calldata joinData,
        uint256 minReturn,
        ISingleTokenJoinV2.UnderlyingTrade[] calldata joinTokenTrades,
        address _permitCaller
    ) external initializer {
        _initialize(safeName, _owner, _investmentSafeFactory, _creator);
        uint256 gasCost = investmentSafeFactory.getWethUsedForGas(
            investmentSafeFactory.GAS_CREATE_SAFE()
        );
        _delegatedJoin(joinData, minReturn, joinTokenTrades, _creator, gasCost, _permitCaller);
    }

    function initializeAndExit(
        string memory safeName,
        address _owner,
        address _investmentSafeFactory,
        address _creator,
        DelegateExitData calldata exitData,
        uint256 minReturn,
        ISingleNativeTokenExitV2.ExitUnderlyingTrade[] calldata exitTokenTrades,
        address _permitCaller
    ) external initializer {
        _initialize(safeName, _owner, _investmentSafeFactory, _creator);
        uint256 gasCost = 0;
        if (_owner != _creator) {
            gasCost = investmentSafeFactory.getWethUsedForGas(
                investmentSafeFactory.GAS_CREATE_SAFE()
            );
        }
        _delegatedExit(exitData, minReturn, exitTokenTrades, _creator, gasCost, _permitCaller);
    }

    /// @dev Invalidate nonces
    /// @param user The user address to set nonce for
    /// @param nonce The new nonce
    function setNonce(address user, uint256 nonce) external onlyOwner {
        require(nonce > nonces[user], "can only invalidate new nonces");
        nonces[user] = nonce;
    }

    /// @dev Remove ERC20 token from safe
    /// @param token ERC20 address
    /// @param amount The amount to be withdrawn
    function withdrawFromSafe(address token, uint256 amount)
        external
        onlyOwner
    {
        _withdrawFromSafe(token, msg.sender, amount);
    }

    function _withdrawFromSafe(
        address _token,
        address _beneficiary,
        uint256 _amount
    ) internal requireNonZero(_token, _amount) {
        IERC20(_token).safeTransfer(_beneficiary, _amount);

        emit SafeWithdraw(_token, _beneficiary, _amount);
    }

    /// @dev Check ERC20 token balances
    /// @param token ERC20 address
    function balanceOfInSafe(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    // fallback function
    receive() external payable onlyOwner {}

    /// @dev Remove native token from safe
    /// @param amount The amount to be withdrawn
    function withdrawNativeTokenFromSafe(uint256 amount) external onlyOwner {
        _withdrawNativeTokenFromSafe(msg.sender, amount);
    }

    function _withdrawNativeTokenFromSafe(address _beneficiary, uint256 _amount)
        internal
    {
        require(_amount > 0, "amount is zero");
        (bool success, ) = _beneficiary.call{value: _amount}("");
        require(success, "Transfer failed.");
    }

    /// @dev Check native token balance
    function balanceOfNativeTokenInSafe() external view returns (uint256) {
        return address(this).balance;
    }

    function _maxApprove(
        IERC20 token,
        address spender,
        uint256 amount
    ) internal {
        if (token.allowance(address(this), spender) < amount) {
            token.approve(spender, type(uint256).max);
        }
    }

    //////////////////////////  PERMIT FUNCTIONS //////////////////////////

    function getPermitHash(
        bytes32 permitHash,
        address sender,
        address token,
        uint256 amount,
        uint256 targetAmount,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32 hash) {
        bytes32 structHash = keccak256(
            abi.encode(
                permitHash,
                sender,
                token,
                amount,
                targetAmount,
                nonce,
                deadline
            )
        );

        hash = _hashTypedDataV4(structHash);
    }

    function _checkJoinSignature(DelegateJoinData calldata joinData, address caller)
        internal
        virtual
    {
        bytes32 hash = getPermitHash(
            investmentSafeFactory._PERMIT_JOIN_TYPEHASH(),
            caller,
            joinData.targetToken,
            joinData.amount,
            joinData.targetAmount,
            nonces[caller],
            joinData.deadline
        );
        address signer = ECDSA.recover(
            hash,
            joinData.v,
            joinData.r,
            joinData.s
        );
        require(signer == owner, "JoinPermit: invalid signature");
    }

    /// @dev Delegated join and bridging back of target token
    /// @param joinData Struct of all data required to join basket and validate signature
    /// @param minReturn Minimal basket amount expected
    /// @param joinTokenTrades Trades to execute
    function delegatedJoin(
        DelegateJoinData calldata joinData,
        uint256 minReturn,
        ISingleTokenJoinV2.UnderlyingTrade[] calldata joinTokenTrades
    ) external override {
        _delegatedJoin(joinData, minReturn, joinTokenTrades, msg.sender, 0, msg.sender);
    }

    function _delegatedJoin(
        DelegateJoinData calldata joinData,
        uint256 minReturn,
        ISingleTokenJoinV2.UnderlyingTrade[] calldata joinTokenTrades,
        address caller,
        uint256 extraGas,
        address permitCaller
    ) internal {
        require(
            block.timestamp <= joinData.deadline,
            "JoinPermit: expired deadline"
        );
        require(
            minReturn >= joinData.targetAmount,
            "JoinPermit: minReturn to small"
        );
        require(!isSecondJoinStep[permitCaller], "NOT_STEP1");
        require(exitStep[permitCaller] == Steps.One, "IN_EXIT_PROCCESS");

        isSecondJoinStep[permitCaller] = true;

        IERC20 weth = IERC20(investmentSafeFactory.weth());
        uint256 balance = weth.balanceOf(address(this));
        require(
            balance >= joinData.amount,
            "JoinPermit: amount exceeds balance"
        );
        uint256 gasCost = investmentSafeFactory
            .getWethUsedForGas(investmentSafeFactory.JOIN_GAS())
            .add(extraGas);
        uint256 amountAfterGasCost = joinData.amount.sub(gasCost);

        {
            _checkJoinSignature(joinData, permitCaller);

            weth.safeTransfer(caller, gasCost);
        }

        address underlying = IPolygonERC20Wrapper(joinData.targetToken)
            .underlying();
        ISingleTokenJoinV2.JoinTokenStructV2
            memory joinParams = ISingleTokenJoinV2.JoinTokenStructV2(
                investmentSafeFactory.weth(),
                underlying,
                amountAfterGasCost,
                minReturn,
                joinTokenTrades,
                joinData.deadline,
                0
            );

        _maxApprove(
            weth,
            investmentSafeFactory.singleTokenJoin(),
            amountAfterGasCost
        );
        bridgeAmount = IERC20(underlying).balanceOf(address(this));

        ISingleTokenJoinV2(investmentSafeFactory.singleTokenJoin())
            .joinTokenSingle(joinParams);
        require(
            balance <= weth.balanceOf(address(this)).add(joinData.amount),
            "JoinPermit: Insufficient input"
        );
        _maxApprove(IERC20(underlying), joinData.targetToken, minReturn);
        bridgeAmount = IERC20(underlying).balanceOf(address(this)).sub(
            bridgeAmount
        );
    }

    function delegatedJoin2(DelegateJoinData calldata joinData) external {
        require(isSecondJoinStep[msg.sender], "NOT_STEP2");
        isSecondJoinStep[msg.sender] = false;
        _checkJoinSignature(joinData, msg.sender);
        nonces[msg.sender] = nonces[msg.sender] + 1;

        IPolygonERC20Wrapper(joinData.targetToken).withdrawTo(
            bridgeAmount,
            owner
        );
        emit DelegatedJoin(
            joinData.targetToken,
            owner,
            joinData.amount,
            bridgeAmount
        );
    }

    function _checkExitSignature(DelegateExitData calldata exitData, address caller)
        internal
        virtual
    {
        bytes32 hash = getPermitHash(
            investmentSafeFactory._PERMIT_EXIT_TYPEHASH(),
            caller,
            exitData.sourceToken,
            exitData.amount,
            exitData.targetAmount,
            nonces[caller],
            exitData.deadline
        );

        address signer = ECDSA.recover(
            hash,
            exitData.v,
            exitData.r,
            exitData.s
        );
        require(signer == owner, "ExitPermit: invalid signature");
    }

    /// @dev Delegated exit and bridging back of target token
    /// @param exitData Struct of all data required to exit basket and validate signature
    /// @param minReturn Minimal basket amount expected
    /// @param exitTokenTrades Trades to execute
    function delegatedExit(
        DelegateExitData calldata exitData,
        uint256 minReturn,
        ISingleNativeTokenExitV2.ExitUnderlyingTrade[] calldata exitTokenTrades
    ) public override {
        _delegatedExit(exitData, minReturn, exitTokenTrades, msg.sender, 0, msg.sender);
    }

    /// @dev Delegated exit and bridging back of target token
    /// @param exitData Struct of all data required to exit basket and validate signature
    /// @param minReturn Minimal basket amount expected
    /// @param exitTokenTrades Trades to execute
    function _delegatedExit(
        DelegateExitData calldata exitData,
        uint256 minReturn,
        ISingleNativeTokenExitV2.ExitUnderlyingTrade[] calldata exitTokenTrades,
        address caller,
        uint256 extraGas,
        address permitCaller
    ) internal {
        require(
            block.timestamp <= exitData.deadline,
            "ExitPermit: expired deadline"
        );
        require(
            minReturn >= exitData.targetAmount,
            "ExitPermit: minReturn to small"
        );
        require(exitStep[permitCaller] == Steps.One, "NOT_STEP_ONE");
        require(!isSecondJoinStep[permitCaller], "IN_JOIN_PROCCESS");

        exitStep[permitCaller] = Steps.Two;

        _checkExitSignature(exitData, permitCaller);

        ISingleNativeTokenExitV2.ExitTokenStructV2
            memory _exitTokenStruct = ISingleNativeTokenExitV2
                .ExitTokenStructV2(
                    exitData.sourceToken,
                    exitData.amount,
                    minReturn,
                    exitData.deadline,
                    0,
                    exitTokenTrades
                );
        IERC20 weth = IERC20(investmentSafeFactory.weth());

        uint256 amountBefore = weth.balanceOf(address(this));

        _maxApprove(
            IERC20(exitData.sourceToken),
            investmentSafeFactory.singleTokenExit(),
            exitData.amount
        );
        ISingleNativeTokenExitV2(investmentSafeFactory.singleTokenExit()).exit(
            _exitTokenStruct
        );
        uint256 targetAmount = weth.balanceOf(address(this)).sub(amountBefore);

        require(minReturn <= targetAmount, "ExitPermit: Insufficient output");

        {
            uint256 gasCost = investmentSafeFactory.getWethUsedForGas(
                investmentSafeFactory.EXIT_GAS()
            ).add(extraGas);
            bridgeAmount = targetAmount.sub(gasCost);
            weth.safeTransfer(caller, gasCost);
        }

        _maxApprove(weth, investmentSafeFactory.childAmunWeth(), bridgeAmount);
    }

    function delegatedExit2(DelegateExitData calldata exitData) external {
        require(exitStep[msg.sender] == Steps.Two, "NOT_STEP_TWO");
        exitStep[msg.sender] = Steps.Three;
        _checkExitSignature(exitData, msg.sender);

        IChildAmunWeth(investmentSafeFactory.childAmunWeth()).getAmunWeth(
            bridgeAmount
        );
    }

    function delegatedExit3(DelegateExitData calldata exitData) external {
        require(exitStep[msg.sender] == Steps.Three, "NOT_STEP_THREE");
        exitStep[msg.sender] = Steps.One;
        _checkExitSignature(exitData, msg.sender);
        nonces[msg.sender] = nonces[msg.sender] + 1;

        IChildAmunWeth(investmentSafeFactory.childAmunWeth()).withdrawTo(
            bridgeAmount,
            owner
        );
        emit DelegatedExit(
            exitData.sourceToken,
            owner,
            exitData.amount,
            bridgeAmount
        );
    }

    // solhint-disable-next-line func-name-mixedcase
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
